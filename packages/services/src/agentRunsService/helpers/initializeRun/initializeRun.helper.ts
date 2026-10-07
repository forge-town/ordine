import { resolve } from "node:path";

import {
  AgentRunRequestSchema,
  createInitialAgentRunActivityMetrics,
  createInitialAgentRunActivitySnapshot,
  TERMINAL_AGENT_RUN_STATUSES,
  type AgentRunRequest,
} from "@repo/schemas";
import { ResultAsync } from "neverthrow";
import { redactSensitiveText } from "../sanitizeAgentRunData/sanitizeAgentRunData.helper";
import {
  SUPPORTED_RUNTIMES,
  CONTROL_MODE_SUPPORTED_RUNTIMES,
  EVENT_RETENTION_MS,
  type ActiveRun,
  type AgentRunsServiceBindings,
} from "../../contracts";
import type {
  AgentRunTransientOptions,
  AgentRunTransientLease,
  AgentRunTransientFactory,
} from "../../agentRuns.service";
import { toError } from "../toError";
import { capabilitySnapshotForRuntime } from "../capabilitySnapshotForRuntime";

export const createInitializeRunHelper =
  (
    serviceBindings: Pick<
      AgentRunsServiceBindings,
      | "resolveRuntimeConfig"
      | "admission"
      | "AdmissionClosedError"
      | "AgentControlModeUnsupportedError"
      | "runsDao"
      | "finishRun"
      | "executorId"
      | "executorLeaseMs"
      | "executorHeartbeatMs"
      | "activeRuns"
      | "executeRun"
      | "getPublicRun"
      | "executions"
    >,
  ) =>
  async (
    input: AgentRunRequest,
    transientSource: AgentRunTransientOptions | AgentRunTransientFactory = {},
  ): Promise<{ runId: string }> => {
    const request = AgentRunRequestSchema.parse(input);
    const runtimeConfig = await (0, serviceBindings.resolveRuntimeConfig)(request.runtimeConfigId);
    if (!serviceBindings.admission.open) throw new serviceBindings.AdmissionClosedError();
    if (!SUPPORTED_RUNTIMES.has(runtimeConfig.type)) {
      throw new Error(`Agent Run control does not support ${runtimeConfig.type}`);
    }
    if (request.controlMode && !CONTROL_MODE_SUPPORTED_RUNTIMES.has(runtimeConfig.type)) {
      throw new serviceBindings.AgentControlModeUnsupportedError(runtimeConfig.type);
    }
    const id = crypto.randomUUID();
    const now = new Date();
    const runtimeCapabilities = capabilitySnapshotForRuntime(runtimeConfig.type);
    const activitySnapshot = createInitialAgentRunActivitySnapshot(id, runtimeConfig.type);
    const activityMetrics = createInitialAgentRunActivityMetrics();
    await serviceBindings.runsDao.create({
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
    const cancelInitialization = async (dispose?: AgentRunTransientLease["dispose"]) => {
      const released = await ResultAsync.fromPromise(
        Promise.resolve().then(() => dispose?.()),
        toError,
      );
      await (0, serviceBindings.finishRun)({
        runId: id,
        runtime: runtimeConfig.type,
        status: "cancelled",
        resultText: "",
        nativeSessionId: null,
        usage: null,
        errorCode: null,
        errorMessage: null,
      });
      if (released.isErr()) throw released.error;

      return { runId: id };
    };
    if (!serviceBindings.admission.open) return cancelInitialization();
    const transientPromise: Promise<AgentRunTransientLease> = Promise.resolve().then(() => {
      if (!serviceBindings.admission.open) throw new serviceBindings.AdmissionClosedError();

      return typeof transientSource === "function" ? transientSource(id) : transientSource;
    });
    const transientResult = await ResultAsync.fromPromise(transientPromise, toError);
    if (transientResult.isErr()) {
      if (!serviceBindings.admission.open) return cancelInitialization();
      await (0, serviceBindings.finishRun)({
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
    if (!serviceBindings.admission.open) return cancelInitialization(dispose);
    const claimedAt = new Date();
    const claim = await ResultAsync.fromPromise(
      serviceBindings.runsDao.claimExecutor(
        id,
        serviceBindings.executorId,
        claimedAt,
        new Date(claimedAt.getTime() + serviceBindings.executorLeaseMs),
      ),
      toError,
    );
    if (claim.isErr()) {
      const released = await ResultAsync.fromPromise(
        Promise.resolve().then(() => dispose?.()),
        toError,
      );
      await (0, serviceBindings.finishRun)({
        runId: id,
        runtime: runtimeConfig.type,
        status: serviceBindings.admission.open ? "failed" : "cancelled",
        resultText: "",
        nativeSessionId: null,
        usage: null,
        errorCode: "AGENT_RUN_CONTROL_FAILED",
        errorMessage: claim.error.message,
      });
      if (released.isErr()) throw released.error;
      throw claim.error;
    }
    if (!claim.value) {
      await Promise.resolve().then(() => dispose?.());
      throw new Error(`Agent run ${id} could not claim its executor lease`);
    }
    if (!serviceBindings.admission.open) return cancelInitialization(dispose);
    const active: ActiveRun = {
      controller: new AbortController(),
      abortReason: null,
      ...(dispose ? { dispose } : {}),
    };
    const heartbeat = async (): Promise<void> => {
      const heartbeatAt = new Date();
      const lease = await serviceBindings.runsDao.refreshLease(
        id,
        serviceBindings.executorId,
        heartbeatAt,
        new Date(heartbeatAt.getTime() + serviceBindings.executorLeaseMs),
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
    }, serviceBindings.executorHeartbeatMs);
    serviceBindings.activeRuns.set(id, active);
    const execution = (0, serviceBindings.executeRun)(
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
      const released = await ResultAsync.fromPromise(
        Promise.resolve().then(() => release?.()),
        toError,
      );
      serviceBindings.activeRuns.delete(id);
      if (released.isErr()) throw released.error;
    };
    const settled = execution.then(
      (result) => result,
      async (error: unknown) => {
        const failure = toError(error);
        const existing = await serviceBindings.runsDao.findById(id);
        if (existing && !TERMINAL_AGENT_RUN_STATUSES.has(existing.status)) {
          return (0, serviceBindings.finishRun)({
            runId: id,
            runtime: runtimeConfig.type,
            status: active.controller.signal.aborted ? "cancelled" : "failed",
            resultText: "",
            nativeSessionId: existing.nativeSessionId,
            usage: existing.usage,
            errorCode: "AGENT_RUN_CONTROL_FAILED",
            errorMessage: failure.message,
          });
        }
        if (existing) return (0, serviceBindings.getPublicRun)(existing);
        throw failure;
      },
    );
    const tracked = settled.then(
      async (result) => {
        await cleanup();

        return result;
      },
      async (error: unknown) => {
        await cleanup();
        throw error;
      },
    );
    serviceBindings.executions.set(id, tracked);
    void tracked.then(
      () => {
        serviceBindings.executions.delete(id);
      },
      () => {
        serviceBindings.executions.delete(id);
      },
    );

    return { runId: id };
  };
