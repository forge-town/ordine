import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import {
  applyAgentRunActivityPatch,
  createAgentRunEventCoalescer,
  reduceAgentRunActivity,
  reduceAgentRunActivityEvents,
  type AgentRunEventEmitMeta,
} from "@repo/agent-activity";
import { agentEngine, type AgentRunOptions, type AgentRunOutcome } from "@repo/agent-engine";
import { getRuntimeManifest, probeRuntimeCapabilities, scanRuntimes } from "@repo/agent";
import type { agentRunsTable, AgentRunRecord } from "@repo/db-schema";
import {
  createAgentRunEventsDao,
  createAgentRunsDao,
  createAgentRuntimesDao,
  type DbConnection,
} from "@repo/models";
import {
  AgentRunRequestSchema,
  AgentRunSchema,
  AgentRunActivityMetricsSchema,
  AgentRunActivitySnapshotSchema,
  AgentRunActivityTelemetrySchema,
  createInitialAgentRunActivityMetrics,
  createInitialAgentRunActivitySnapshot,
  AgentControlEventSchema,
  RuntimeEventSchema,
  parseLocalAgentRuntimeId,
  RuntimeCapabilitiesSchema,
  type AgentRun,
  type AgentControlEvent,
  type AgentRunEvent,
  type AgentRunEventEnvelope,
  type AgentRunRequest,
  type ParsedAgentRunRequest,
  type AgentRunStatus,
  type AgentRunUsage,
  type AgentRuntime,
  type AgentRunActivityMetrics,
  type AgentRunActivityTelemetry,
  type RuntimeCapabilities,
  type RuntimeEvent,
} from "@repo/schemas";
import { ResultAsync } from "neverthrow";
import { redactSensitiveText, sanitizeAgentRunEvent } from "./sanitizeAgentRunData";

const SUPPORTED_RUNTIMES = new Set<AgentRuntime>(["claude-code", "codex", "opencode"]);
const CONTROL_MODE_SUPPORTED_RUNTIMES = new Set<AgentRuntime>(["claude-code", "codex"]);
const TERMINAL_STATUSES = new Set<AgentRunStatus>([
  "completed",
  "failed",
  "cancelled",
  "timed_out",
  "interrupted",
]);
const EVENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const FIRST_OUTPUT_TIMEOUT_MS = 45_000;
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
const EXECUTOR_LEASE_MS = 15_000;
const EXECUTOR_HEARTBEAT_MS = 2_000;
const SESSION_NOT_FOUND =
  /(?:session|thread|rollout).{0,80}(?:not found|does not exist|missing|unknown|invalid)|no (?:session|thread|rollout)/i;

type RuntimeConfig = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createAgentRuntimesDao>["findById"]>>
>;
type EventListener = (event: AgentRunEventEnvelope) => Promise<void> | void;
type AbortReason = "user_cancel" | "first_output_timeout" | "inactivity_timeout";
type TerminalAgentRunStatus = Extract<
  AgentRunStatus,
  "completed" | "failed" | "cancelled" | "timed_out"
>;
type AgentRunPatch = Partial<Omit<typeof agentRunsTable.$inferInsert, "id">>;
type ActivityMetricsDelta = Partial<Record<keyof AgentRunActivityMetrics, number>>;

type ActiveRun = {
  controller: AbortController;
  abortReason: AbortReason | null;
  dispose?: () => Promise<void> | void;
  heartbeatTimer?: ReturnType<typeof setInterval>;
};

type ResolvedRuntime = {
  path: string;
  version: string | null;
  fingerprint: string;
  resolutionWarning: string | null;
  supportsPartialMessages: boolean;
  supportsPermissionBypass: boolean;
  supportsReasoningEffort: boolean;
  supportsVariant: boolean;
  supportsAutoPermissions: boolean;
  supportsResume: boolean;
  runtimeCapabilities: RuntimeCapabilities;
};

type AgentRunsServiceDependencies = {
  runAgent?: typeof agentEngine.run;
  scan?: typeof scanRuntimes;
  probeCapabilities?: typeof probeRuntimeCapabilities;
  readExecutable?: typeof readFile;
  firstOutputTimeoutMs?: number;
  inactivityTimeoutMs?: number;
  executorLeaseMs?: number;
  executorHeartbeatMs?: number;
};

export type AgentRunTransientOptions = Pick<
  AgentRunOptions,
  | "apiKey"
  | "attachments"
  | "connectorInjection"
  | "getMcpConnectorInjection"
  | "githubToken"
  | "environment"
>;

export type AgentRunTransientLease = AgentRunTransientOptions & {
  dispose?: () => Promise<void> | void;
};

export type AgentRunTransientFactory = (
  runId: string,
) => Promise<AgentRunTransientLease> | AgentRunTransientLease;

export class AgentControlModeUnsupportedError extends Error {
  readonly code = "CONTROL_MODE_UNSUPPORTED";

  constructor(readonly runtime: AgentRuntime) {
    super(`${runtime} is not verified for MCP-only Agent Control mode`);
    this.name = "AgentControlModeUnsupportedError";
  }
}

const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

type RuntimeExecutableResolutionInput = {
  runtime: AgentRuntime;
  configuredPath?: string;
  configuredVersion?: string;
  detectedPath?: string;
  detectedVersion?: string;
  readExecutable: (path: string) => Promise<Uint8Array>;
  probeCapabilities: typeof probeRuntimeCapabilities;
};

export const resolveRuntimeExecutable = async ({
  runtime,
  configuredPath,
  configuredVersion,
  detectedPath,
  detectedVersion,
  readExecutable,
  probeCapabilities,
}: RuntimeExecutableResolutionInput): Promise<ResolvedRuntime> => {
  const duplicateDetectedPath =
    Boolean(configuredPath && detectedPath) &&
    (process.platform === "win32"
      ? detectedPath?.toLowerCase() === configuredPath?.toLowerCase()
      : detectedPath === configuredPath);
  const candidates = [
    ...(configuredPath
      ? [
          {
            path: configuredPath,
            version:
              configuredVersion ?? (duplicateDetectedPath ? detectedVersion : undefined) ?? null,
            source: "configured" as const,
          },
        ]
      : []),
    ...(detectedPath && !duplicateDetectedPath
      ? [{ path: detectedPath, version: detectedVersion ?? null, source: "detected" as const }]
      : []),
  ];
  const failures: string[] = [];

  for (const candidate of candidates) {
    if (!isAbsolute(candidate.path)) {
      failures.push(`${candidate.source} path is not absolute: ${candidate.path}`);
      continue;
    }
    const bytesResult = await ResultAsync.fromPromise(readExecutable(candidate.path), toError);
    if (bytesResult.isErr()) {
      failures.push(
        `${candidate.source} path is not readable: ${candidate.path} (${bytesResult.error.message})`,
      );
      continue;
    }
    const capabilitiesResult = await ResultAsync.fromPromise(
      probeCapabilities({ runtime, path: candidate.path }),
      toError,
    );
    if (capabilitiesResult.isErr()) {
      failures.push(
        `${candidate.source} path capability probe failed: ${candidate.path} (${capabilitiesResult.error.message})`,
      );
      continue;
    }
    const capabilities = capabilitiesResult.value;
    const manifest = getRuntimeManifest(runtime);
    const missingCapabilities = [
      capabilities.structuredOutput ? null : "structured_output",
      capabilities.resume ? null : "native_resume",
      runtime !== "claude-code" || capabilities.sessionId ? null : "session_id",
    ].filter((value): value is string => value !== null);
    if (missingCapabilities.length > 0) {
      failures.push(
        `${candidate.source} path is missing ${missingCapabilities.join(", ")}: ${candidate.path}`,
      );
      continue;
    }

    return {
      path: candidate.path,
      version: candidate.version,
      fingerprint: createHash("sha256").update(bytesResult.value).digest("hex"),
      resolutionWarning:
        candidate.source === "detected" && configuredPath
          ? `Configured ${runtime} executable was unusable; ORDINE selected the freshly detected PATH executable ${candidate.path}.`
          : null,
      supportsPartialMessages: capabilities.partialMessages,
      supportsPermissionBypass: capabilities.skipPermissions,
      supportsReasoningEffort: capabilities.reasoningEffort,
      supportsVariant: capabilities.variant,
      supportsAutoPermissions: capabilities.autoPermissions,
      supportsResume: capabilities.resume,
      runtimeCapabilities: {
        ...manifest.capabilities,
        textStreaming: capabilities.partialMessages ? "delta" : manifest.capabilities.textStreaming,
        cancellation:
          manifest.capabilities.cancellation === "none"
            ? "none"
            : manifest.capabilities.cancellation,
        resume: capabilities.resume ? manifest.capabilities.resume : "none",
        pause: "none",
      },
    };
  }

  throw new Error(
    candidates.length === 0
      ? `Absolute executable path is unavailable for ${runtime}`
      : `No usable ${runtime} executable was found. ${failures.join("; ")}`,
  );
};

const toPublicRun = (record: AgentRunRecord): AgentRun =>
  AgentRunSchema.parse({
    id: record.id,
    owner: { type: record.ownerType, id: record.ownerId },
    runtimeConfigId: record.runtimeConfigId,
    runtime: record.runtime,
    status: record.status,
    executablePath: record.executablePath,
    executableVersion: record.executableVersion,
    executableFingerprint: record.executableFingerprint,
    model: record.model,
    reasoningEffort: record.reasoningEffort,
    speed: record.speed,
    cwd: record.cwd,
    nativeSessionId: record.nativeSessionId,
    resumeFromRunId: record.resumeFromRunId,
    permissionMode: record.permissionMode,
    networkAccess: record.networkAccess,
    controlMode: record.controlMode,
    allowedTools: record.allowedTools,
    controlScopes: record.controlScopes,
    runtimeCapabilities: record.runtimeCapabilities ?? null,
    activitySnapshot: record.activitySnapshot ?? null,
    activityMetrics: record.activityMetrics ?? null,
    usage: record.usage,
    resultText: record.resultText,
    errorCode: record.errorCode,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt.toISOString(),
    startedAt: record.startedAt?.toISOString() ?? null,
    firstOutputAt: record.firstOutputAt?.toISOString() ?? null,
    lastActivityAt: record.lastActivityAt?.toISOString() ?? null,
    finishedAt: record.finishedAt?.toISOString() ?? null,
  });

const runtimeEvent = (runtime: AgentRuntime, payload: Record<string, unknown>): RuntimeEvent =>
  RuntimeEventSchema.parse({
    ...payload,
    runtime,
    timestamp: new Date().toISOString(),
  });

const bytesOfJson = (value: unknown): number =>
  new TextEncoder().encode(JSON.stringify(value) ?? "").byteLength;

const mergeActivityMetrics = (
  current: AgentRunActivityMetrics | null | undefined,
  delta: ActivityMetricsDelta,
): AgentRunActivityMetrics => {
  const next = AgentRunActivityMetricsSchema.parse(current ?? {});
  for (const [key, value] of Object.entries(delta) as [keyof AgentRunActivityMetrics, number][]) {
    if (!value) continue;
    next[key] += value;
  }

  return AgentRunActivityMetricsSchema.parse(next);
};

const capabilitySnapshotForRuntime = (runtime: AgentRuntime): RuntimeCapabilities =>
  getRuntimeManifest(runtime).capabilities;

const isOutputEvent = (event: RuntimeEvent): boolean =>
  event.type === "text_delta" ||
  event.type === "message" ||
  event.type === "thinking_delta" ||
  event.type === "thinking" ||
  event.type === "tool_start" ||
  event.type === "tool_update" ||
  event.type === "tool_result";

const mergeUsage = (current: AgentRunUsage | null, event: RuntimeEvent): AgentRunUsage | null => {
  if (event.type !== "usage") return current;

  return {
    ...(current ?? {}),
    ...(event.inputTokens === undefined ? {} : { inputTokens: event.inputTokens }),
    ...(event.outputTokens === undefined ? {} : { outputTokens: event.outputTokens }),
    ...(event.cachedInputTokens === undefined
      ? {}
      : { cachedInputTokens: event.cachedInputTokens }),
    ...(event.costUsd === undefined ? {} : { costUsd: event.costUsd }),
  };
};

const terminalStatusForAbort = (reason: AbortReason | null): TerminalAgentRunStatus =>
  reason === "first_output_timeout" || reason === "inactivity_timeout" ? "timed_out" : "cancelled";

const formatTimeout = (milliseconds: number): string => {
  const seconds = Math.round(milliseconds / 1000);
  if (seconds % 60 === 0) return `${seconds / 60} minute${seconds === 60 ? "" : "s"}`;

  return `${seconds} seconds`;
};

const abortError = (
  reason: AbortReason,
  firstOutputTimeoutMs: number,
  inactivityTimeoutMs: number,
): { code: string; message: string } => {
  if (reason === "first_output_timeout") {
    return {
      code: "AGENT_FIRST_OUTPUT_TIMEOUT",
      message: `Agent produced no model output within ${formatTimeout(firstOutputTimeoutMs)}`,
    };
  }
  if (reason === "inactivity_timeout") {
    return {
      code: "AGENT_INACTIVITY_TIMEOUT",
      message: `Agent produced no activity for ${formatTimeout(inactivityTimeoutMs)}`,
    };
  }

  return { code: "AGENT_RUN_CANCELLED", message: "Agent run was cancelled" };
};

export const commitAgentRunEventBeforeBroadcast = async <T>(
  persist: () => Promise<T>,
  broadcast: (committed: T) => Promise<void>,
): Promise<T> => {
  const committed = await persist();
  await broadcast(committed);

  return committed;
};

export const createAgentRunsService = (
  db: DbConnection,
  dependencies: AgentRunsServiceDependencies = {},
) => {
  const runsDao = createAgentRunsDao(db);
  const eventsDao = createAgentRunEventsDao(db);
  const runtimesDao = createAgentRuntimesDao(db);
  const runAgent = dependencies.runAgent ?? agentEngine.runDirect;
  const scan = dependencies.scan ?? scanRuntimes;
  const probeCapabilities = dependencies.probeCapabilities ?? probeRuntimeCapabilities;
  const readExecutable = dependencies.readExecutable ?? readFile;
  const firstOutputTimeoutMs = dependencies.firstOutputTimeoutMs ?? FIRST_OUTPUT_TIMEOUT_MS;
  const inactivityTimeoutMs = dependencies.inactivityTimeoutMs ?? INACTIVITY_TIMEOUT_MS;
  const executorLeaseMs = dependencies.executorLeaseMs ?? EXECUTOR_LEASE_MS;
  const executorHeartbeatMs = dependencies.executorHeartbeatMs ?? EXECUTOR_HEARTBEAT_MS;
  const executorId = crypto.randomUUID();
  const activeRuns = new Map<string, ActiveRun>();
  const executions = new Map<string, Promise<AgentRun>>();
  const listeners = new Map<string, Set<EventListener>>();
  const eventPersistenceQueues = new Map<string, Promise<unknown>>();

  const broadcast = async (envelope: AgentRunEventEnvelope): Promise<void> => {
    const runListeners = listeners.get(envelope.runId);
    if (!runListeners || runListeners.size === 0) return;
    await Promise.allSettled([...runListeners].map((listener) => listener(envelope)));
  };

  const serializeRunPersistence = <T>(runId: string, operation: () => Promise<T>): Promise<T> => {
    const previous = eventPersistenceQueues.get(runId) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    const marker = current.then(
      () => {
        if (eventPersistenceQueues.get(runId) === marker) eventPersistenceQueues.delete(runId);
      },
      () => {
        if (eventPersistenceQueues.get(runId) === marker) eventPersistenceQueues.delete(runId);
      },
    );
    eventPersistenceQueues.set(runId, marker);

    return current;
  };

  const persistEvent = async (
    runId: string,
    event: AgentRunEvent,
    runPatch: AgentRunPatch = {},
    activityMetricsDelta: ActivityMetricsDelta = {},
  ): Promise<AgentRunEventEnvelope> => {
    const sanitized = sanitizeAgentRunEvent(event);

    return serializeRunPersistence(runId, async () =>
      commitAgentRunEventBeforeBroadcast(
        () =>
          db.transaction(async (transaction) => {
            const transactionRunsDao = createAgentRunsDao(transaction);
            const transactionEventsDao = createAgentRunEventsDao(transaction);
            const current = await transactionRunsDao.findById(runId);
            if (!current) throw new Error(`Agent run not found: ${runId}`);
            if (TERMINAL_STATUSES.has(current.status) && sanitized.type !== "terminal") {
              throw new Error(`Agent run ${runId} has an immutable terminal state`);
            }
            const terminalTransition =
              sanitized.type === "terminal"
                ? await transactionRunsDao.transition(runId, ["queued", "running", "cancelling"], {
                    ...runPatch,
                    status: sanitized.status,
                    executorId: null,
                    heartbeatAt: null,
                    leaseExpiresAt: null,
                  })
                : null;
            if (sanitized.type === "terminal" && !terminalTransition) {
              const existing = await transactionEventsDao.findTerminalByRunId(runId);
              if (!existing) throw new Error(`Agent run ${runId} has an immutable terminal state`);

              return {
                runId,
                sequence: existing.sequence,
                createdAt: existing.createdAt.toISOString(),
                event: existing.event,
              } satisfies AgentRunEventEnvelope;
            }
            const transitioned =
              terminalTransition ??
              (Object.keys(runPatch).length > 0
                ? await transactionRunsDao.transition(
                    runId,
                    ["queued", "running", "cancelling"],
                    runPatch,
                  )
                : null) ??
              current;

            const created = await transactionEventsDao.create({ runId, event: sanitized });
            const envelope = {
              runId,
              sequence: created.sequence,
              createdAt: created.createdAt.toISOString(),
              event: created.event,
            } satisfies AgentRunEventEnvelope;
            const priorSnapshot = transitioned.activitySnapshot
              ? AgentRunActivitySnapshotSchema.safeParse(transitioned.activitySnapshot)
              : null;
            const snapshotBeforeEvent = priorSnapshot?.success
              ? priorSnapshot.data
              : reduceAgentRunActivityEvents(
                  runId,
                  transitioned.runtime,
                  (await transactionEventsDao.findManyByRunIdAfter(runId, 0, 100_000)).map(
                    (entry) => ({
                      runId,
                      sequence: entry.sequence,
                      createdAt: entry.createdAt.toISOString(),
                      event: entry.event,
                    }),
                  ),
                  "queued",
                );
            const reducedSnapshot = reduceAgentRunActivity(snapshotBeforeEvent, envelope).snapshot;
            const snapshot = applyAgentRunActivityPatch(reducedSnapshot, {
              ...(sanitized.type === "terminal"
                ? {
                    status: sanitized.status,
                    terminalMessage: sanitized.resultText ?? null,
                    terminalAt: envelope.createdAt,
                  }
                : {}),
              ...(runPatch.status ? { status: runPatch.status } : {}),
              ...(runPatch.usage !== undefined
                ? { usage: (runPatch.usage ?? null) as AgentRunUsage | null }
                : {}),
              ...(runPatch.errorCode !== undefined
                ? { errorCode: runPatch.errorCode ?? null }
                : {}),
              ...(runPatch.resultText !== undefined
                ? { terminalMessage: runPatch.resultText ?? null }
                : {}),
              ...(runPatch.finishedAt !== undefined
                ? { terminalAt: runPatch.finishedAt?.toISOString() ?? null }
                : {}),
            });
            const existingMetrics = transitioned.activityMetrics
              ? AgentRunActivityMetricsSchema.safeParse(transitioned.activityMetrics)
              : null;
            const metrics = mergeActivityMetrics(
              existingMetrics?.success ? existingMetrics.data : null,
              {
                eventCount: 1,
                bytes: bytesOfJson(sanitized),
                ...activityMetricsDelta,
              },
            );
            await transactionRunsDao.update(runId, {
              ...(sanitized.type === "terminal" ? { terminalEventSequence: created.sequence } : {}),
              activitySnapshot: snapshot,
              activityMetrics: metrics,
            });

            return envelope;
          }),
        broadcast,
      ),
    );
  };

  const resolveRuntimeConfig = async (runtimeConfigId: string): Promise<RuntimeConfig> => {
    const stored = await runtimesDao.findById(runtimeConfigId);
    if (stored) return stored;
    const localRuntime = parseLocalAgentRuntimeId(runtimeConfigId);
    if (!localRuntime) throw new Error(`Agent runtime config not found: ${runtimeConfigId}`);

    return {
      id: runtimeConfigId,
      name: localRuntime,
      type: localRuntime,
      connection: { mode: "local" },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  };

  const resolveRuntime = async (config: RuntimeConfig): Promise<ResolvedRuntime> => {
    if (config.connection.mode !== "local") {
      throw new Error(`Agent Run control currently requires a local runtime: ${config.id}`);
    }
    const detected = await scan();
    const matched = detected.find((candidate) => candidate.type === config.type);

    return resolveRuntimeExecutable({
      runtime: config.type,
      configuredPath: config.connection.path,
      configuredVersion: config.connection.version,
      detectedPath: matched?.path,
      detectedVersion: matched?.version,
      readExecutable,
      probeCapabilities,
    });
  };

  const getRunRecord = async (runId: string): Promise<AgentRunRecord> => {
    const run = await runsDao.findById(runId);
    if (!run) throw new Error(`Agent run not found: ${runId}`);

    return run;
  };

  const ensureActivityProjection = async (record: AgentRunRecord): Promise<AgentRunRecord> => {
    // Legacy runs are projected from their canonical events without mutating
    // the record during a read. New writes backfill the durable snapshot in
    // the same event transaction, so this path remains a strictly read-only
    // compatibility fallback.
    const parsedSnapshot = record.activitySnapshot
      ? AgentRunActivitySnapshotSchema.safeParse(record.activitySnapshot)
      : null;
    const parsedMetrics = record.activityMetrics
      ? AgentRunActivityMetricsSchema.safeParse(record.activityMetrics)
      : null;
    const parsedCapabilities = record.runtimeCapabilities
      ? RuntimeCapabilitiesSchema.safeParse(record.runtimeCapabilities)
      : null;
    if (parsedSnapshot?.success && parsedMetrics?.success && parsedCapabilities?.success) {
      return record;
    }

    const events = await eventsDao.findManyByRunIdAfter(record.id, 0, 100_000);
    const envelopes = events.map((event) => ({
      runId: record.id,
      sequence: event.sequence,
      createdAt: event.createdAt.toISOString(),
      event: event.event,
    })) satisfies AgentRunEventEnvelope[];
    const rebuiltSnapshot = parsedSnapshot?.success
      ? applyAgentRunActivityPatch(parsedSnapshot.data, {
          status: record.status,
          usage: record.usage,
          errorCode: record.errorCode,
          terminalMessage: record.resultText,
          terminalAt: record.finishedAt?.toISOString() ?? null,
        })
      : reduceAgentRunActivityEvents(record.id, record.runtime, envelopes, "queued");
    const snapshot = AgentRunActivitySnapshotSchema.parse(rebuiltSnapshot);
    const metrics = parsedMetrics?.success
      ? parsedMetrics.data
      : AgentRunActivityMetricsSchema.parse({
          eventCount: events.length,
          bytes: events.reduce((total, event) => total + bytesOfJson(event.event), 0),
        });
    const runtimeCapabilities = parsedCapabilities?.success
      ? parsedCapabilities.data
      : capabilitySnapshotForRuntime(record.runtime);

    return {
      ...record,
      runtimeCapabilities,
      activitySnapshot: snapshot,
      activityMetrics: metrics,
    };
  };

  const getPublicRun = async (record: AgentRunRecord): Promise<AgentRun> =>
    toPublicRun(await ensureActivityProjection(record));

  const finishRun = async ({
    runId,
    runtime,
    status,
    resultText,
    nativeSessionId,
    usage,
    errorCode,
    errorMessage,
  }: {
    runId: string;
    runtime: AgentRuntime;
    status: TerminalAgentRunStatus;
    resultText: string;
    nativeSessionId: string | null;
    usage: AgentRunUsage | null;
    errorCode: string | null;
    errorMessage: string | null;
  }): Promise<AgentRun> => {
    const now = new Date();
    await persistEvent(
      runId,
      runtimeEvent(runtime, {
        type: "terminal",
        status,
        exitCode: null,
        signal: null,
        resultText,
        ...(nativeSessionId ? { sessionId: nativeSessionId } : {}),
      }),
      {
        status,
        resultText: redactSensitiveText(resultText),
        nativeSessionId,
        usage,
        errorCode,
        errorMessage: errorMessage ? redactSensitiveText(errorMessage) : null,
        lastActivityAt: now,
        finishedAt: now,
      },
    );

    return getPublicRun(await getRunRecord(runId));
  };

  const executeRun = async (
    runId: string,
    request: ParsedAgentRunRequest,
    runtimeConfig: RuntimeConfig,
    active: ActiveRun,
    transient: AgentRunTransientOptions,
  ): Promise<AgentRun> => {
    const runtime = runtimeConfig.type;
    const effectiveFirstOutputTimeoutMs = request.firstOutputTimeoutMs ?? firstOutputTimeoutMs;
    const resolvedResult = await ResultAsync.fromPromise(resolveRuntime(runtimeConfig), toError);
    if (resolvedResult.isErr()) {
      if (active.controller.signal.aborted) {
        const reason = active.abortReason ?? "user_cancel";
        const error = abortError(reason, effectiveFirstOutputTimeoutMs, inactivityTimeoutMs);

        return finishRun({
          runId,
          runtime,
          status: terminalStatusForAbort(reason),
          resultText: "",
          nativeSessionId: null,
          usage: null,
          errorCode: error.code,
          errorMessage: error.message,
        });
      }
      await persistEvent(
        runId,
        runtimeEvent(runtime, {
          type: "diagnostic",
          level: "error",
          code: "RUNTIME_RESOLUTION_FAILED",
          message: resolvedResult.error.message,
        }),
      );

      return finishRun({
        runId,
        runtime,
        status: active.abortReason ? terminalStatusForAbort(active.abortReason) : "failed",
        resultText: "",
        nativeSessionId: null,
        usage: null,
        errorCode: "RUNTIME_RESOLUTION_FAILED",
        errorMessage: resolvedResult.error.message,
      });
    }
    const resolvedRuntime = resolvedResult.value;
    await runsDao.update(runId, { runtimeCapabilities: resolvedRuntime.runtimeCapabilities });
    if (resolvedRuntime.resolutionWarning) {
      await persistEvent(
        runId,
        runtimeEvent(runtime, {
          type: "diagnostic",
          level: "warning",
          code: "RUNTIME_PATH_FALLBACK",
          message: resolvedRuntime.resolutionWarning,
        }),
      );
    }
    const startedAt = new Date();
    const running = await runsDao.transition(runId, ["queued"], {
      status: active.controller.signal.aborted ? "cancelling" : "running",
      executablePath: resolvedRuntime.path,
      executableVersion: resolvedRuntime.version,
      executableFingerprint: resolvedRuntime.fingerprint,
      startedAt,
      lastActivityAt: startedAt,
    });
    if (!running) {
      const latest = await getRunRecord(runId);
      if (latest.status === "cancelling" && !active.controller.signal.aborted) {
        active.abortReason = "user_cancel";
        active.controller.abort();
      }
    }
    if (active.controller.signal.aborted) {
      const reason = active.abortReason ?? "user_cancel";
      const error = abortError(reason, effectiveFirstOutputTimeoutMs, inactivityTimeoutMs);

      return finishRun({
        runId,
        runtime,
        status: terminalStatusForAbort(reason),
        resultText: "",
        nativeSessionId: null,
        usage: null,
        errorCode: error.code,
        errorMessage: error.message,
      });
    }

    const state = {
      firstOutput: false,
      nativeSessionId: null as string | null,
      usage: null as AgentRunUsage | null,
      firstOutputTimer: undefined as ReturnType<typeof setTimeout> | undefined,
      inactivityTimer: undefined as ReturnType<typeof setTimeout> | undefined,
      eventPersistenceError: null as Error | null,
    };
    const abortFor = (reason: AbortReason): void => {
      if (active.controller.signal.aborted) return;
      active.abortReason = reason;
      active.controller.abort();
    };
    const resetFirstOutputTimer = (): void => {
      if (state.firstOutputTimer) clearTimeout(state.firstOutputTimer);
      if (effectiveFirstOutputTimeoutMs === 0) {
        state.firstOutputTimer = undefined;

        return;
      }
      state.firstOutputTimer = setTimeout(
        () => abortFor("first_output_timeout"),
        effectiveFirstOutputTimeoutMs,
      );
    };
    const resetInactivityTimer = (): void => {
      if (state.inactivityTimer) clearTimeout(state.inactivityTimer);
      state.inactivityTimer = setTimeout(() => abortFor("inactivity_timeout"), inactivityTimeoutMs);
    };
    const clearTimers = (): void => {
      if (state.firstOutputTimer) clearTimeout(state.firstOutputTimer);
      if (state.inactivityTimer) clearTimeout(state.inactivityTimer);
    };
    resetFirstOutputTimer();
    resetInactivityTimer();

    const handleEvent = async (
      event: RuntimeEvent,
      emitMeta: AgentRunEventEmitMeta = { coalesced: false, deltaCount: 1 },
    ): Promise<void> => {
      if (event.type === "terminal") return;
      const now = new Date();
      const patch: AgentRunPatch = {
        lastActivityAt: now,
      };
      resetInactivityTimer();
      if (!state.firstOutput && isOutputEvent(event)) {
        state.firstOutput = true;
        patch.firstOutputAt = now;
        if (state.firstOutputTimer) clearTimeout(state.firstOutputTimer);
      }
      if (event.type === "session") {
        state.nativeSessionId = event.id;
        patch.nativeSessionId = event.id;
      }
      state.usage = mergeUsage(state.usage, event);
      if (event.type === "usage") patch.usage = state.usage;
      // Control runs are action-streamed rather than token-streamed. Persisting
      // every model/thinking token creates thousands of replay events without
      // adding useful UI state; the final terminal result and tool lifecycle
      // events remain durable.
      if (request.controlMode && (event.type === "text_delta" || event.type === "thinking_delta")) {
        return;
      }
      await persistEvent(runId, event, patch, {
        ...(emitMeta.coalesced ? { coalescedEventCount: 1 } : {}),
      });
    };
    const eventCoalescer = createAgentRunEventCoalescer(handleEvent);
    const handleAdapterEvent = async (event: RuntimeEvent): Promise<void> => {
      const handled = await ResultAsync.fromPromise(eventCoalescer.push(event), toError);
      if (handled.isErr()) state.eventPersistenceError ??= handled.error;
    };

    const previous = request.resumeFromRunId
      ? await runsDao.findById(request.resumeFromRunId)
      : null;
    const normalizedModel = request.model ?? null;
    const normalizedReasoningEffort = request.reasoningEffort ?? null;
    const normalizedSpeed = request.speed ?? null;
    const resumeMismatch = previous
      ? [
          previous.ownerType !== request.owner.type ? "owner" : null,
          previous.ownerId !== request.owner.id ? "owner" : null,
          previous.runtimeConfigId !== request.runtimeConfigId ? "runtime_config" : null,
          previous.executableFingerprint !== resolvedRuntime.fingerprint
            ? "executable_fingerprint"
            : null,
          previous.model !== normalizedModel ? "model" : null,
          previous.reasoningEffort !== normalizedReasoningEffort ? "reasoning_effort" : null,
          previous.speed !== normalizedSpeed ? "speed" : null,
          resolve(previous.cwd) !== resolve(request.cwd) ? "cwd" : null,
          previous.status !== "completed" ? "terminal_status" : null,
          !previous.nativeSessionId ? "native_session" : null,
          !resolvedRuntime.supportsResume ? "resume_capability" : null,
        ].filter((value): value is string => value !== null)
      : request.resumeFromRunId
        ? ["source_run"]
        : [];
    const resumeSessionId =
      previous && resumeMismatch.length === 0 ? previous.nativeSessionId : null;
    if (request.resumeFromRunId && resumeMismatch.length > 0) {
      await handleEvent(
        runtimeEvent(runtime, {
          type: "diagnostic",
          level: "warning",
          code: "RESUME_GUARD_REJECTED",
          message: `Native resume was rejected because these fields changed: ${[...new Set(resumeMismatch)].join(", ")}`,
        }),
      );
    }

    const runAttempt = async (resumeId: string | null, prompt: string) =>
      ResultAsync.fromPromise(
        runAgent({
          agent: runtime,
          mode: "direct",
          systemPrompt: request.systemPrompt,
          userPrompt: prompt,
          cwd: request.cwd,
          allowedTools: request.allowedTools,
          model: request.model,
          reasoningEffort: request.reasoningEffort,
          speed: request.speed,
          resumeSessionId: resumeId ?? undefined,
          executablePath: resolvedRuntime.path,
          permissionMode: request.permissionMode,
          fullAccessConfirmed: request.fullAccessConfirmed,
          networkAccess: request.networkAccess,
          controlMode: request.controlMode,
          supportsPartialMessages: resolvedRuntime.supportsPartialMessages,
          supportsPermissionBypass: resolvedRuntime.supportsPermissionBypass,
          supportsReasoningEffort: resolvedRuntime.supportsReasoningEffort,
          supportsVariant: resolvedRuntime.supportsVariant,
          supportsAutoPermissions: resolvedRuntime.supportsAutoPermissions,
          signal: active.controller.signal,
          ...transient,
          onRuntimeEvent: handleAdapterEvent,
        }),
        toError,
      );

    const firstAttempt = await runAttempt(
      resumeSessionId,
      resumeSessionId
        ? request.prompt
        : request.resumeFromRunId
          ? request.rebuildPrompt
          : request.prompt,
    );
    const attemptState: {
      outcome: AgentRunOutcome | null;
      finalError: Error | null;
    } = {
      outcome: firstAttempt.isOk() ? firstAttempt.value : null,
      finalError: firstAttempt.isErr() ? firstAttempt.error : null,
    };
    const applyEventPersistenceFailure = (): void => {
      const persistenceError = state.eventPersistenceError as Error | null;
      if (!persistenceError) return;

      attemptState.outcome = null;
      attemptState.finalError = new Error(
        `Runtime event persistence failed: ${persistenceError.message}`,
      );
    };
    applyEventPersistenceFailure();

    if (
      firstAttempt.isErr() &&
      resumeSessionId &&
      !active.controller.signal.aborted &&
      !state.eventPersistenceError &&
      SESSION_NOT_FOUND.test(firstAttempt.error.message)
    ) {
      await handleEvent(
        runtimeEvent(runtime, {
          type: "retry",
          phase: "starting",
          attempt: 1,
          message: "Native session was unavailable; rebuilding one fresh session",
        }),
      );
      if (previous) await runsDao.update(previous.id, { nativeSessionId: null });
      state.nativeSessionId = null;
      state.firstOutput = false;
      resetFirstOutputTimer();
      const retry = await runAttempt(null, request.rebuildPrompt);
      attemptState.outcome = retry.isOk() ? retry.value : null;
      attemptState.finalError = retry.isErr() ? retry.error : null;
      applyEventPersistenceFailure();
      await handleEvent(
        runtimeEvent(runtime, {
          type: "retry",
          phase: retry.isOk() ? "succeeded" : "exhausted",
          attempt: 1,
          message: retry.isOk()
            ? "Fresh session rebuild succeeded"
            : "Fresh session rebuild failed",
        }),
      );
    }

    const flushedEvents = await ResultAsync.fromPromise(eventCoalescer.flush(), toError);
    if (flushedEvents.isErr()) state.eventPersistenceError ??= flushedEvents.error;
    eventCoalescer.dispose();
    clearTimers();
    applyEventPersistenceFailure();
    if (active.controller.signal.aborted) {
      const reason = active.abortReason ?? "user_cancel";
      const error = abortError(reason, effectiveFirstOutputTimeoutMs, inactivityTimeoutMs);

      return finishRun({
        runId,
        runtime,
        status: terminalStatusForAbort(reason),
        resultText: attemptState.outcome?.text ?? "",
        nativeSessionId: state.nativeSessionId,
        usage: state.usage,
        errorCode: error.code,
        errorMessage: error.message,
      });
    }
    if (attemptState.finalError) {
      await handleEvent(
        runtimeEvent(runtime, {
          type: "diagnostic",
          level: "error",
          code: "AGENT_EXECUTION_FAILED",
          message: attemptState.finalError.message,
          retryable: false,
        }),
      );

      return finishRun({
        runId,
        runtime,
        status: "failed",
        resultText: "",
        nativeSessionId: state.nativeSessionId,
        usage: state.usage,
        errorCode: "AGENT_EXECUTION_FAILED",
        errorMessage: attemptState.finalError.message,
      });
    }

    return finishRun({
      runId,
      runtime,
      status: "completed",
      resultText: attemptState.outcome?.text ?? "",
      nativeSessionId: state.nativeSessionId,
      usage: state.usage,
      errorCode: null,
      errorMessage: null,
    });
  };

  const startInternal = async (
    input: AgentRunRequest,
    transientSource: AgentRunTransientOptions | AgentRunTransientFactory = {},
  ): Promise<{ runId: string }> => {
    const request = AgentRunRequestSchema.parse(input);
    const runtimeConfig = await resolveRuntimeConfig(request.runtimeConfigId);
    if (!SUPPORTED_RUNTIMES.has(runtimeConfig.type)) {
      throw new Error(`Agent Run control does not support ${runtimeConfig.type}`);
    }
    if (request.controlMode && !CONTROL_MODE_SUPPORTED_RUNTIMES.has(runtimeConfig.type)) {
      throw new AgentControlModeUnsupportedError(runtimeConfig.type);
    }
    const id = crypto.randomUUID();
    const now = new Date();
    const runtimeCapabilities = capabilitySnapshotForRuntime(runtimeConfig.type);
    const activitySnapshot = createInitialAgentRunActivitySnapshot(id, runtimeConfig.type);
    const activityMetrics = createInitialAgentRunActivityMetrics();
    await runsDao.create({
      id,
      ownerType: request.owner.type,
      ownerId: request.owner.id,
      runtimeConfigId: request.runtimeConfigId,
      runtime: runtimeConfig.type,
      status: "queued",
      model: request.model ?? null,
      reasoningEffort: request.reasoningEffort ?? null,
      speed: request.speed ?? null,
      cwd: resolve(request.cwd),
      systemPrompt: redactSensitiveText(request.systemPrompt),
      prompt: redactSensitiveText(request.prompt),
      rebuildPrompt: redactSensitiveText(request.rebuildPrompt),
      resumeFromRunId: request.resumeFromRunId ?? null,
      permissionMode: request.permissionMode,
      networkAccess: request.networkAccess,
      controlMode: request.controlMode,
      allowedTools: request.allowedTools,
      controlScopes: request.controlScopes,
      runtimeCapabilities,
      activitySnapshot,
      activityMetrics,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + EVENT_RETENTION_MS),
    });
    const transientPromise: Promise<AgentRunTransientLease> = Promise.resolve(
      typeof transientSource === "function" ? transientSource(id) : transientSource,
    );
    const transientResult = await ResultAsync.fromPromise(transientPromise, toError);
    if (transientResult.isErr()) {
      await finishRun({
        runId: id,
        runtime: runtimeConfig.type,
        status: "failed",
        resultText: "",
        nativeSessionId: null,
        usage: null,
        errorCode: "AGENT_RUN_TRANSIENT_SETUP_FAILED",
        errorMessage: transientResult.error.message,
      });

      return { runId: id };
    }
    const { dispose, ...transient } = transientResult.value;
    const claimedAt = new Date();
    const claimed = await runsDao.claimExecutor(
      id,
      executorId,
      claimedAt,
      new Date(claimedAt.getTime() + executorLeaseMs),
    );
    if (!claimed) {
      await Promise.resolve(dispose?.());
      throw new Error(`Agent run ${id} could not claim its executor lease`);
    }
    const active: ActiveRun = {
      controller: new AbortController(),
      abortReason: null,
      ...(dispose ? { dispose } : {}),
    };
    const heartbeat = async (): Promise<void> => {
      const heartbeatAt = new Date();
      const lease = await runsDao.refreshLease(
        id,
        executorId,
        heartbeatAt,
        new Date(heartbeatAt.getTime() + executorLeaseMs),
      );
      if (lease?.cancelRequestedAt && !active.controller.signal.aborted) {
        active.abortReason = "user_cancel";
        active.controller.abort();
        const release = active.dispose;
        active.dispose = undefined;
        await Promise.resolve(release?.());
      }
    };
    active.heartbeatTimer = setInterval(() => {
      void heartbeat().then(
        () => undefined,
        () => undefined,
      );
    }, executorHeartbeatMs);
    activeRuns.set(id, active);
    const execution = executeRun(
      id,
      { ...request, cwd: resolve(request.cwd) },
      runtimeConfig,
      active,
      transient,
    );
    const cleanup = async (): Promise<void> => {
      if (active.heartbeatTimer) clearInterval(active.heartbeatTimer);
      const release = active.dispose;
      active.dispose = undefined;
      await Promise.resolve(release?.());
      activeRuns.delete(id);
      executions.delete(id);
    };
    const tracked = execution.then(
      async (result) => {
        await cleanup();

        return result;
      },
      async (error: unknown) => {
        await cleanup();
        const failure = toError(error);
        const existing = await runsDao.findById(id);
        if (existing && !TERMINAL_STATUSES.has(existing.status)) {
          return finishRun({
            runId: id,
            runtime: runtimeConfig.type,
            status: "failed",
            resultText: "",
            nativeSessionId: existing.nativeSessionId,
            usage: existing.usage,
            errorCode: "AGENT_RUN_CONTROL_FAILED",
            errorMessage: failure.message,
          });
        }
        if (existing) return getPublicRun(existing);
        throw failure;
      },
    );
    executions.set(id, tracked);
    void tracked.then(
      () => undefined,
      () => undefined,
    );

    return { runId: id };
  };

  return {
    start: startInternal,

    async execute(request: AgentRunRequest): Promise<AgentRun> {
      const { runId } = await startInternal(request);
      const execution = executions.get(runId);
      if (!execution) throw new Error(`Agent run execution was not registered: ${runId}`);

      return execution;
    },

    async getById(runId: string): Promise<AgentRun | null> {
      const run = await runsDao.findById(runId);

      return run ? getPublicRun(run) : null;
    },

    async getLatestByOwner(ownerType: string, ownerId: string): Promise<AgentRun | null> {
      const run = await runsDao.findLatestByOwner(ownerType, ownerId);

      return run ? getPublicRun(run) : null;
    },

    async wait(runId: string): Promise<AgentRun> {
      const execution = executions.get(runId);
      if (execution) return execution;
      const run = await getRunRecord(runId);
      if (TERMINAL_STATUSES.has(run.status)) return getPublicRun(run);

      throw new Error(`Agent run ${runId} is not executing in this service process`);
    },

    async getEvents(runId: string, after = 0, limit = 500): Promise<AgentRunEventEnvelope[]> {
      const run = await runsDao.findById(runId);
      if (!run) throw new Error(`Agent run not found: ${runId}`);
      const boundedLimit = Math.max(1, Math.min(Math.floor(limit), 2_000));
      const events = await eventsDao.findManyByRunIdAfter(runId, after, boundedLimit);

      return events.map((event) => ({
        runId,
        sequence: event.sequence,
        createdAt: event.createdAt.toISOString(),
        event: event.event,
      }));
    },

    async appendControlEvent(
      runId: string,
      input: AgentControlEvent,
    ): Promise<AgentRunEventEnvelope> {
      const run = await getRunRecord(runId);
      if (!run.controlMode) throw new Error(`Agent run ${runId} is not an Agent Control run`);
      const event = AgentControlEventSchema.parse(input);
      if (event.runtime !== run.runtime) {
        throw new Error(`Agent Control event runtime does not match run ${runId}`);
      }

      return persistEvent(runId, event);
    },

    subscribe(runId: string, listener: EventListener): () => void {
      const runListeners = listeners.get(runId) ?? new Set<EventListener>();
      runListeners.add(listener);
      listeners.set(runId, runListeners);

      return () => {
        runListeners.delete(listener);
        if (runListeners.size === 0) listeners.delete(runId);
      };
    },

    async cancel(runId: string): Promise<AgentRun> {
      const run = await getRunRecord(runId);
      if (TERMINAL_STATUSES.has(run.status)) return getPublicRun(run);
      const requested = await runsDao.requestCancel(runId, new Date());
      const active = activeRuns.get(runId);
      if (active && !active.controller.signal.aborted) {
        active.abortReason = "user_cancel";
        active.controller.abort();
        const release = active.dispose;
        active.dispose = undefined;
        await Promise.resolve(release?.());
      }
      const updated = requested ?? (await runsDao.findById(runId));

      return getPublicRun(updated ?? run);
    },

    async recordActivityTelemetry(
      runId: string,
      input: AgentRunActivityTelemetry,
    ): Promise<AgentRun> {
      const telemetry = AgentRunActivityTelemetrySchema.parse(input);
      const run = await getRunRecord(runId);
      const metrics = mergeActivityMetrics(run.activityMetrics, {
        ...(telemetry.kind === "artifact_open_failed" ? { artifactOpenFailureCount: 1 } : {}),
      });
      const updated = await runsDao.update(runId, { activityMetrics: metrics });

      return getPublicRun(updated ?? { ...run, activityMetrics: metrics });
    },

    async recoverInterruptedRuns(): Promise<{ count: number; runIds: string[] }> {
      const unfinished = await runsDao.findManyRecoverable(new Date());
      for (const run of unfinished) {
        await persistEvent(
          run.id,
          runtimeEvent(run.runtime, {
            type: "diagnostic",
            level: "error",
            code: "SERVER_RESTART_INTERRUPTED",
            message: "The ORDINE service restarted while this run was active",
            retryable: true,
          }),
        );
        const now = new Date();
        await persistEvent(
          run.id,
          runtimeEvent(run.runtime, {
            type: "terminal",
            status: "interrupted",
            exitCode: null,
            signal: null,
            resultText: run.resultText ?? "",
            ...(run.nativeSessionId ? { sessionId: run.nativeSessionId } : {}),
          }),
          {
            status: "interrupted",
            errorCode: "SERVER_RESTART_INTERRUPTED",
            errorMessage: "The ORDINE service restarted while this run was active",
            lastActivityAt: now,
            finishedAt: now,
          },
        );
      }

      return { count: unfinished.length, runIds: unfinished.map((run) => run.id) };
    },

    async deleteExpired(before = new Date()): Promise<number> {
      const deleted = await runsDao.deleteExpired(before);

      return deleted.length;
    },
  };
};
