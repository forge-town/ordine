import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { agentEngine, type AgentRunOptions, type AgentRunOutcome } from "@repo/agent-engine";
import { probeRuntimeCapabilities, scanRuntimes } from "@repo/agent";
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
  AgentControlEventSchema,
  RuntimeEventSchema,
  parseLocalAgentRuntimeId,
  type AgentRun,
  type AgentControlEvent,
  type AgentRunEvent,
  type AgentRunEventEnvelope,
  type AgentRunRequest,
  type ParsedAgentRunRequest,
  type AgentRunStatus,
  type AgentRunUsage,
  type AgentRuntime,
  type RuntimeEvent,
} from "@repo/schemas";
import { ResultAsync } from "neverthrow";
import { redactSensitiveText, sanitizeAgentRunEvent } from "./sanitizeAgentRunData";

const SUPPORTED_RUNTIMES = new Set<AgentRuntime>(["claude-code", "codex", "opencode"]);
const CONTROL_MODE_SUPPORTED_RUNTIMES = new Set<AgentRuntime>(["claude-code"]);
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
  supportsPartialMessages: boolean;
  supportsPermissionBypass: boolean;
  supportsReasoningEffort: boolean;
  supportsVariant: boolean;
  supportsAutoPermissions: boolean;
  supportsResume: boolean;
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

  const broadcast = async (envelope: AgentRunEventEnvelope): Promise<void> => {
    const runListeners = listeners.get(envelope.runId);
    if (!runListeners || runListeners.size === 0) return;
    await Promise.allSettled([...runListeners].map((listener) => listener(envelope)));
  };

  const persistEvent = async (
    runId: string,
    event: AgentRunEvent,
    runPatch: AgentRunPatch = {},
  ): Promise<AgentRunEventEnvelope> => {
    const sanitized = sanitizeAgentRunEvent(event);

    return commitAgentRunEventBeforeBroadcast(
      () =>
        db.transaction(async (transaction) => {
          const transactionRunsDao = createAgentRunsDao(transaction);
          const transactionEventsDao = createAgentRunEventsDao(transaction);
          if (sanitized.type === "terminal") {
            const transitioned = await transactionRunsDao.transition(
              runId,
              ["queued", "running", "cancelling"],
              {
                ...runPatch,
                status: sanitized.status,
                executorId: null,
                heartbeatAt: null,
                leaseExpiresAt: null,
              },
            );
            if (!transitioned) {
              const existing = await transactionEventsDao.findTerminalByRunId(runId);
              if (!existing) throw new Error(`Agent run ${runId} has an immutable terminal state`);

              return {
                runId,
                sequence: existing.sequence,
                createdAt: existing.createdAt.toISOString(),
                event: existing.event,
              } satisfies AgentRunEventEnvelope;
            }
          }
          const created = await transactionEventsDao.create({
            runId,
            event: sanitized,
          });
          if (sanitized.type === "terminal") {
            await transactionRunsDao.update(runId, { terminalEventSequence: created.sequence });
          } else if (Object.keys(runPatch).length > 0) {
            await transactionRunsDao.transition(
              runId,
              ["queued", "running", "cancelling"],
              runPatch,
            );
          }

          return {
            runId,
            sequence: created.sequence,
            createdAt: created.createdAt.toISOString(),
            event: created.event,
          } satisfies AgentRunEventEnvelope;
        }),
      broadcast,
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
    const configuredPath = config.connection.path;
    const executablePath = configuredPath ?? matched?.path;
    if (!executablePath || !isAbsolute(executablePath)) {
      throw new Error(`Absolute executable path is unavailable for ${config.type}`);
    }
    const bytesResult = await ResultAsync.fromPromise(readExecutable(executablePath), toError);
    if (bytesResult.isErr()) {
      throw new Error(`Runtime executable is not readable: ${executablePath}`, {
        cause: bytesResult.error,
      });
    }
    const fingerprint = createHash("sha256").update(bytesResult.value).digest("hex");
    const capabilities = await probeCapabilities({ runtime: config.type, path: executablePath });
    const missingCapabilities = [
      !capabilities.structuredOutput ? "structured_output" : null,
      !capabilities.resume ? "native_resume" : null,
      config.type === "claude-code" && !capabilities.sessionId ? "session_id" : null,
    ].filter((value): value is string => value !== null);
    if (missingCapabilities.length > 0) {
      throw new Error(
        `${config.type} CLI is missing required capabilities: ${missingCapabilities.join(", ")}`,
      );
    }

    return {
      path: executablePath,
      version: config.connection.version ?? matched?.version ?? null,
      fingerprint,
      supportsPartialMessages: capabilities.partialMessages,
      supportsPermissionBypass: capabilities.skipPermissions,
      supportsReasoningEffort: capabilities.reasoningEffort,
      supportsVariant: capabilities.variant,
      supportsAutoPermissions: capabilities.autoPermissions,
      supportsResume: capabilities.resume,
    };
  };

  const getRunRecord = async (runId: string): Promise<AgentRunRecord> => {
    const run = await runsDao.findById(runId);
    if (!run) throw new Error(`Agent run not found: ${runId}`);

    return run;
  };

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

    return toPublicRun(await getRunRecord(runId));
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

    const handleEvent = async (event: RuntimeEvent): Promise<void> => {
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
      await persistEvent(runId, event, patch);
    };
    const handleAdapterEvent = async (event: RuntimeEvent): Promise<void> => {
      const handled = await ResultAsync.fromPromise(handleEvent(event), toError);
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

    clearTimers();
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
        if (existing) return toPublicRun(existing);
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

      return run ? toPublicRun(run) : null;
    },

    async getLatestByOwner(ownerType: string, ownerId: string): Promise<AgentRun | null> {
      const run = await runsDao.findLatestByOwner(ownerType, ownerId);

      return run ? toPublicRun(run) : null;
    },

    async wait(runId: string): Promise<AgentRun> {
      const execution = executions.get(runId);
      if (execution) return execution;
      const run = await getRunRecord(runId);
      if (TERMINAL_STATUSES.has(run.status)) return toPublicRun(run);

      throw new Error(`Agent run ${runId} is not executing in this service process`);
    },

    async getEvents(runId: string, after = 0): Promise<AgentRunEventEnvelope[]> {
      const run = await runsDao.findById(runId);
      if (!run) throw new Error(`Agent run not found: ${runId}`);
      const events = await eventsDao.findManyByRunIdAfter(runId, after);

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
      if (TERMINAL_STATUSES.has(run.status)) return toPublicRun(run);
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

      return toPublicRun(updated ?? run);
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
