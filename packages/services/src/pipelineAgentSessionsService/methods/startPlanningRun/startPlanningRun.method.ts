import { ResultAsync } from "neverthrow";

import {
  PIPELINE_PLANNING_SYSTEM_PROMPT,
  type PipelineAgentSessionsServiceBindings,
} from "../../contracts";

import { createRuntimeNotFoundError } from "../../helpers/createRuntimeNotFoundError";
import { createRuntimeModelMismatchError } from "../../helpers/createRuntimeModelMismatchError";
import { isCancellationError } from "../../helpers/isCancellationError";

export const createStartPlanningRunMethod =
  (
    serviceBindings: Pick<
      PipelineAgentSessionsServiceBindings,
      | "sessionsDao"
      | "beginActivity"
      | "messagesDao"
      | "contextArtifactsDao"
      | "settingsDao"
      | "operationsDao"
      | "agentRuntimesDao"
      | "assertActivityActive"
      | "finishActivity"
      | "buildPlanningPrompt"
      | "getAgentRunsService"
      | "planningRuns"
      | "persistPlanningOutput"
      | "planningCompletions"
    >,
  ) =>
  async (
    sessionId: string,
    input?: {
      runtimeId?: string;
      model?: string;
      reasoningEffort?: string;
      speed?: string;
      firstOutputTimeoutSeconds?: number;
      permissionMode?: "read-only" | "workspace-write" | "full-access";
      networkAccess?: boolean;
      fullAccessConfirmed?: boolean;
    },
  ): Promise<{ runId: string }> => {
    const session = await serviceBindings.sessionsDao.findById(sessionId);
    if (!session) throw new Error(`Pipeline agent session not found: ${sessionId}`);
    const activity = (0, serviceBindings.beginActivity)(sessionId, "planning");
    const [messages, artifacts, settings, operations, runtimes] = await Promise.all([
      serviceBindings.messagesDao.findManyBySessionId(sessionId),
      serviceBindings.contextArtifactsDao.findManyBySessionId(sessionId),
      serviceBindings.settingsDao.get(),
      serviceBindings.operationsDao.findMany(),
      serviceBindings.agentRuntimesDao.findMany(),
    ]);
    (0, serviceBindings.assertActivityActive)(sessionId, activity);
    const selectedRuntime = input?.runtimeId
      ? (runtimes.find((runtime) => runtime.id === input.runtimeId) ?? null)
      : (runtimes.find((runtime) => runtime.id === settings.defaultAgentRuntimeConfigId) ??
        runtimes.find((runtime) => runtime.type === settings.defaultAgentRuntime) ??
        runtimes[0] ??
        null);
    const runtimeId = input?.runtimeId ?? selectedRuntime?.id;
    if (!runtimeId) {
      (0, serviceBindings.finishActivity)(sessionId, activity);
      throw createRuntimeNotFoundError(input?.runtimeId);
    }
    const runtimePreference = settings.agentRuntimePreferences?.[runtimeId];
    const effectiveFirstOutputTimeoutSeconds =
      input?.firstOutputTimeoutSeconds ?? runtimePreference?.firstOutputTimeoutSeconds;
    const effectiveModel = input?.model ?? runtimePreference?.model;
    const runtimeModels =
      selectedRuntime?.connection.mode === "local" ? (selectedRuntime.connection.models ?? []) : [];
    if (
      effectiveModel &&
      runtimeModels.length > 0 &&
      !runtimeModels.some((candidate) => candidate.id === effectiveModel)
    ) {
      (0, serviceBindings.finishActivity)(sessionId, activity);
      throw createRuntimeModelMismatchError(runtimeId, effectiveModel);
    }
    const effectiveReasoningEffort = input?.reasoningEffort ?? runtimePreference?.reasoningEffort;
    const effectiveSpeed = input?.speed ?? runtimePreference?.speed;
    const effectiveFirstOutputTimeoutMs =
      effectiveFirstOutputTimeoutSeconds === undefined
        ? undefined
        : effectiveFirstOutputTimeoutSeconds * 1000;
    const rebuildPrompt = (0, serviceBindings.buildPlanningPrompt)({
      artifacts,
      messages,
      mode: session.mode,
      operations,
      pipelineId: session.pipelineId,
      snapshot: session.snapshot,
    });
    const latestUserMessage = [...messages]
      .reverse()
      .find((message) => message.role === "user")?.content;
    const agentRunsService = (0, serviceBindings.getAgentRunsService)();
    const previous = await agentRunsService.getLatestByOwner("pipeline-agent-session", sessionId);
    const canResumePreviousRun = previous?.status === "completed" && session.status !== "failed";
    await serviceBindings.sessionsDao.update(sessionId, { status: "analyzing" });
    const started = await agentRunsService.start({
      owner: { type: "pipeline-agent-session", id: sessionId },
      runtimeConfigId: runtimeId,
      cwd: process.cwd(),
      model: effectiveModel,
      reasoningEffort: effectiveReasoningEffort,
      speed: effectiveSpeed,
      firstOutputTimeoutMs: effectiveFirstOutputTimeoutMs,
      systemPrompt: PIPELINE_PLANNING_SYSTEM_PROMPT,
      prompt: canResumePreviousRun ? (latestUserMessage ?? rebuildPrompt) : rebuildPrompt,
      rebuildPrompt,
      resumeFromRunId: canResumePreviousRun ? previous.id : undefined,
      permissionMode: input?.permissionMode ?? "full-access",
      networkAccess: input?.networkAccess ?? true,
      fullAccessConfirmed: input?.fullAccessConfirmed ?? true,
      allowedTools: [],
    });
    serviceBindings.planningRuns.set(sessionId, { runId: started.runId, runtimeId });
    const completion = agentRunsService.wait(started.runId).then(
      async (run) => {
        const active = serviceBindings.planningRuns.get(sessionId);
        if (active?.runId !== run.id) return;
        if (run.status !== "completed" || run.resultText === null) {
          serviceBindings.planningRuns.delete(sessionId);
          (0, serviceBindings.finishActivity)(sessionId, activity);
          await serviceBindings.sessionsDao.update(sessionId, {
            status: run.status === "cancelled" ? "awaiting_user" : "failed",
          });

          return;
        }
        const persisted = await ResultAsync.fromPromise(
          (0, serviceBindings.persistPlanningOutput)(sessionId, run.resultText, {
            runtimeId,
            model: effectiveModel,
            reasoningEffort: effectiveReasoningEffort,
            speed: effectiveSpeed,
            firstOutputTimeoutMs: effectiveFirstOutputTimeoutMs,
            signal: activity.controller.signal,
          }),
          (error) => (error instanceof Error ? error : new Error(String(error))),
        );
        if (serviceBindings.planningRuns.get(sessionId)?.runId === run.id)
          serviceBindings.planningRuns.delete(sessionId);
        (0, serviceBindings.finishActivity)(sessionId, activity);
        if (persisted.isErr()) {
          await serviceBindings.sessionsDao.update(sessionId, {
            status: isCancellationError(persisted.error) ? "awaiting_user" : "failed",
          });
        }
      },
      async () => {
        if (serviceBindings.planningRuns.get(sessionId)?.runId === started.runId) {
          serviceBindings.planningRuns.delete(sessionId);
          (0, serviceBindings.finishActivity)(sessionId, activity);
          await serviceBindings.sessionsDao.update(sessionId, { status: "failed" });
        }
      },
    );
    serviceBindings.planningCompletions.set(started.runId, completion);
    void completion.then(
      () => serviceBindings.planningCompletions.delete(started.runId),
      () => serviceBindings.planningCompletions.delete(started.runId),
    );

    return started;
  };
