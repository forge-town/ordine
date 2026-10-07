import { resolve } from "node:path";
import { createAgentRunEventCoalescer, type AgentRunEventEmitMeta } from "@repo/agent-activity";
import type { AgentRunOutcome } from "@repo/agent-engine";

import type { AgentRun, ParsedAgentRunRequest, AgentRunUsage, RuntimeEvent } from "@repo/schemas";
import { err, ResultAsync } from "neverthrow";

import {
  SESSION_NOT_FOUND,
  type RuntimeConfig,
  type AbortReason,
  type AgentRunPatch,
  type ActiveRun,
  type AgentRunsServiceBindings,
} from "../../contracts";
import type { AgentRunTransientOptions } from "../../agentRuns.service";
import { toError } from "../toError";
import { runtimeEvent } from "../runtimeEvent";
import { isOutputEvent } from "../isOutputEvent";
import { mergeUsage } from "../mergeUsage";
import { terminalStatusForAbort } from "../terminalStatusForAbort";
import { abortError } from "../abortError";

export const createExecuteRunHelper =
  (
    serviceBindings: Pick<
      AgentRunsServiceBindings,
      | "firstOutputTimeoutMs"
      | "resolveRuntime"
      | "inactivityTimeoutMs"
      | "finishRun"
      | "persistEvent"
      | "runsDao"
      | "getRunRecord"
      | "AdmissionClosedError"
      | "runAgent"
    >,
  ) =>
  async (
    runId: string,
    request: ParsedAgentRunRequest,
    runtimeConfig: RuntimeConfig,
    active: ActiveRun,
    transient: AgentRunTransientOptions,
  ): Promise<AgentRun> => {
    const runtime = runtimeConfig.type;
    const effectiveFirstOutputTimeoutMs =
      request.firstOutputTimeoutMs ?? serviceBindings.firstOutputTimeoutMs;
    const resolvedResult = await ResultAsync.fromPromise(
      (0, serviceBindings.resolveRuntime)(runtimeConfig),
      toError,
    );
    if (resolvedResult.isErr()) {
      if (active.controller.signal.aborted) {
        const reason = active.abortReason ?? "user_cancel";
        const error = abortError(
          reason,
          effectiveFirstOutputTimeoutMs,
          serviceBindings.inactivityTimeoutMs,
        );

        return (0, serviceBindings.finishRun)({
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
      await (0, serviceBindings.persistEvent)(
        runId,
        runtimeEvent(runtime, {
          type: "diagnostic",
          level: "error",
          code: "RUNTIME_RESOLUTION_FAILED",
          message: resolvedResult.error.message,
        }),
      );

      return (0, serviceBindings.finishRun)({
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
    await serviceBindings.runsDao.update(runId, {
      runtimeCapabilities: resolvedRuntime.runtimeCapabilities,
    });
    if (resolvedRuntime.resolutionWarning) {
      await (0, serviceBindings.persistEvent)(
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
    const running = await serviceBindings.runsDao.transition(runId, ["queued"], {
      status: active.controller.signal.aborted ? "cancelling" : "running",
      executablePath: resolvedRuntime.path,
      executableVersion: resolvedRuntime.version,
      executableFingerprint: resolvedRuntime.fingerprint,
      startedAt,
      lastActivityAt: startedAt,
    });
    if (!running) {
      const latest = await (0, serviceBindings.getRunRecord)(runId);
      if (latest.status === "cancelling" && !active.controller.signal.aborted) {
        active.abortReason = "user_cancel";
        active.controller.abort();
      }
    }
    if (active.controller.signal.aborted) {
      const reason = active.abortReason ?? "user_cancel";
      const error = abortError(
        reason,
        effectiveFirstOutputTimeoutMs,
        serviceBindings.inactivityTimeoutMs,
      );

      return (0, serviceBindings.finishRun)({
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
      state.inactivityTimer = setTimeout(
        () => abortFor("inactivity_timeout"),
        serviceBindings.inactivityTimeoutMs,
      );
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
      await (0, serviceBindings.persistEvent)(
        runId,
        event,
        patch,
        emitMeta.coalesced ? { coalescedEventCount: 1 } : {},
      );
    };
    const eventCoalescer = createAgentRunEventCoalescer(handleEvent);
    const handleAdapterEvent = async (event: RuntimeEvent): Promise<void> => {
      const handled = await ResultAsync.fromPromise(eventCoalescer.push(event), toError);
      if (handled.isErr()) state.eventPersistenceError ??= handled.error;
    };

    const previous = request.resumeFromRunId
      ? await serviceBindings.runsDao.findById(request.resumeFromRunId)
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

    const runAttempt = async (resumeId: string | null, prompt: string) => {
      if (active.controller.signal.aborted) return err(new serviceBindings.AdmissionClosedError());

      return ResultAsync.fromPromise(
        (0, serviceBindings.runAgent)({
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
    };

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
      if (previous) await serviceBindings.runsDao.update(previous.id, { nativeSessionId: null });
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
      const error = abortError(
        reason,
        effectiveFirstOutputTimeoutMs,
        serviceBindings.inactivityTimeoutMs,
      );

      return (0, serviceBindings.finishRun)({
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

      return (0, serviceBindings.finishRun)({
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

    return (0, serviceBindings.finishRun)({
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
