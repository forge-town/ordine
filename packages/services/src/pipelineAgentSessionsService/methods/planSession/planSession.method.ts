import { ResultAsync } from "neverthrow";

import {
  createPipelineAgentMessagesDao,
  createPipelineAgentProposalsDao,
  createPipelineAgentSessionsDao,
} from "@repo/models";
import { PipelineAgentPlanningResultSchema, type PipelineAgentProposal } from "@repo/schemas";

import { runAgent } from "../../../pipelineRunnerService/helpers/agentRunner/agentRunner.helper";

import { parsePlanningResult } from "../../helpers/parsePlanningResult/parsePlanningResult.helper";
import { createPlanningPreviewStreamer } from "../../helpers/streamPlanningPreview/streamPlanningPreview.helper";
import {
  PIPELINE_PLANNING_SYSTEM_PROMPT,
  RelaxedCanvasEditPlanningResultSchema,
  type RelaxedCanvasEditPlanningResult,
  type PipelineAgentSessionsServiceBindings,
} from "../../contracts";

import { createRuntimeNotFoundError } from "../../helpers/createRuntimeNotFoundError";
import { isCancellationError } from "../../helpers/isCancellationError";
import { runAbortable } from "../../helpers/runAbortable";

export const createPlanSessionMethod =
  (
    serviceBindings: Pick<
      PipelineAgentSessionsServiceBindings,
      | "sessionsDao"
      | "beginActivity"
      | "assertActivityActive"
      | "messagesDao"
      | "contextArtifactsDao"
      | "settingsDao"
      | "operationsDao"
      | "agentRuntimesDao"
      | "resolveEffectiveRuntime"
      | "buildPlanningPrompt"
      | "savePlanningQuestion"
      | "pipelinesService"
      | "db"
      | "finishActivity"
    >,
  ) =>
  async (
    sessionId: string,
    input?: {
      onProgress?: (message: string) => Promise<void> | void;
      onTextDelta?: (text: string) => Promise<void> | void;
      runtimeId?: string;
      signal?: AbortSignal;
    },
  ): Promise<
    | { type: "question"; question: string }
    | { type: "proposal"; proposal: PipelineAgentProposal; proposalId: string }
  > => {
    const session = await serviceBindings.sessionsDao.findById(sessionId);
    if (!session) {
      throw new Error(`Pipeline agent session not found: ${sessionId}`);
    }

    const activity = (0, serviceBindings.beginActivity)(sessionId, "planning");
    const handleExternalAbort = () => activity.controller.abort();
    input?.signal?.addEventListener("abort", handleExternalAbort, { once: true });

    const planningResult = await ResultAsync.fromPromise(
      (async () => {
        await serviceBindings.sessionsDao.update(sessionId, { status: "analyzing" });
        (0, serviceBindings.assertActivityActive)(sessionId, activity);
        const [messages, artifacts, settings, operations, runtimes] = await Promise.all([
          serviceBindings.messagesDao.findManyBySessionId(sessionId),
          serviceBindings.contextArtifactsDao.findManyBySessionId(sessionId),
          serviceBindings.settingsDao.get(),
          serviceBindings.operationsDao.findMany(),
          serviceBindings.agentRuntimesDao.findMany(),
        ]);
        (0, serviceBindings.assertActivityActive)(sessionId, activity);
        const effectiveRuntime = (0, serviceBindings.resolveEffectiveRuntime)({
          requestedRuntimeId: input?.runtimeId,
          runtimes,
          defaultRuntime: settings.defaultAgentRuntime ?? null,
        });
        if (!effectiveRuntime) {
          throw createRuntimeNotFoundError(input?.runtimeId);
        }

        const planningPreview = createPlanningPreviewStreamer({
          mode: session.mode,
          onText: (text) => {
            void input?.onTextDelta?.(text);
          },
        });
        const raw = await runAbortable(
          runAgent({
            agent: effectiveRuntime,
            systemPrompt: PIPELINE_PLANNING_SYSTEM_PROMPT,
            userPrompt: (0, serviceBindings.buildPlanningPrompt)({
              artifacts,
              messages,
              mode: session.mode,
              operations,
              pipelineId: session.pipelineId,
              snapshot: session.snapshot,
            }),
            inputPath: process.cwd(),
            agentId: "pipeline-agent-planner",
            allowedTools: [],
            logPrefix: "pipelineAgentPlan",
            apiKey: settings.defaultApiKey,
            model: settings.defaultModel,
            onProgress: input?.onProgress,
            onTextDelta: planningPreview.push,
          }),
          activity.controller.signal,
          sessionId,
        );
        planningPreview.push(raw);
        (0, serviceBindings.assertActivityActive)(sessionId, activity);

        const parsed =
          session.mode === "edit"
            ? parsePlanningResult(raw, RelaxedCanvasEditPlanningResultSchema)
            : parsePlanningResult(raw, PipelineAgentPlanningResultSchema);
        (0, serviceBindings.assertActivityActive)(sessionId, activity);

        if (parsed.type === "question") {
          await (0, serviceBindings.savePlanningQuestion)(sessionId, parsed.question, activity);

          return parsed;
        }

        if (parsed.proposal.readiness !== "ready_for_generation") {
          const question =
            parsed.proposal.openQuestions
              .map((item) => item.trim())
              .filter(Boolean)
              .join("\n") || "Please provide the missing details before I continue.";
          await (0, serviceBindings.savePlanningQuestion)(sessionId, question, activity);

          return { type: "question" as const, question };
        }

        if (session.mode === "edit") {
          const editProposal = (
            parsed as Extract<RelaxedCanvasEditPlanningResult, { type: "proposal" }>
          ).proposal;
          if (!session.snapshot) {
            throw new Error(`Edit session ${sessionId} is missing a graph snapshot`);
          }

          const actionRequest = [
            editProposal.summary,
            editProposal.targetGraphIntent
              ? `Target intent: ${editProposal.targetGraphIntent}`
              : null,
            editProposal.majorChanges.length > 0
              ? `Requested changes: ${editProposal.majorChanges.join("; ")}`
              : null,
            editProposal.assumptions.length > 0
              ? `Assumptions: ${editProposal.assumptions.join("; ")}`
              : null,
          ]
            .filter(Boolean)
            .join("\n");
          const actionProposalResult = await runAbortable(
            serviceBindings.pipelinesService.proposeActions({
              snapshot: session.snapshot,
              message: actionRequest,
              pipelineId: session.pipelineId ?? undefined,
              runtimeId: input?.runtimeId,
            }),
            activity.controller.signal,
            sessionId,
          );
          (0, serviceBindings.assertActivityActive)(sessionId, activity);
          if (!actionProposalResult.proposal) {
            throw new Error("Failed to generate executable canvas edit actions");
          }

          const finalEditProposal: PipelineAgentProposal = {
            mode: "edit",
            assistantReply: editProposal.assistantReply,
            summary: editProposal.summary,
            targetGraphIntent: editProposal.targetGraphIntent ?? editProposal.summary,
            majorChanges: editProposal.majorChanges,
            assumptions: editProposal.assumptions,
            openQuestions: editProposal.openQuestions,
            actions: actionProposalResult.proposal.actions,
            diagnosticsPreview: actionProposalResult.diagnostics,
            readiness: editProposal.readiness,
            pendingOperations: actionProposalResult.pendingOperations ?? [],
          };
          const saved = await serviceBindings.db.transaction(async (tx) => {
            (0, serviceBindings.assertActivityActive)(sessionId, activity);
            const transactionalProposalsDao = createPipelineAgentProposalsDao(tx);
            const transactionalMessagesDao = createPipelineAgentMessagesDao(tx);
            const transactionalSessionsDao = createPipelineAgentSessionsDao(tx);
            const persistedProposal = await transactionalProposalsDao.create({
              id: crypto.randomUUID(),
              sessionId,
              mode: session.mode,
              status: "proposal_ready",
              proposal: finalEditProposal,
              approvedAt: null,
            });
            (0, serviceBindings.assertActivityActive)(sessionId, activity);
            await transactionalMessagesDao.create({
              id: crypto.randomUUID(),
              sessionId,
              role: "assistant",
              kind: "proposal_summary",
              content: finalEditProposal.assistantReply ?? finalEditProposal.summary,
            });
            (0, serviceBindings.assertActivityActive)(sessionId, activity);
            await transactionalSessionsDao.update(sessionId, {
              latestProposalId: persistedProposal.id,
              status: "proposal_ready",
            });
            (0, serviceBindings.assertActivityActive)(sessionId, activity);

            return persistedProposal;
          });

          return {
            type: "proposal" as const,
            proposal: finalEditProposal,
            proposalId: saved.id,
          };
        }

        const generateProposal = parsed.proposal as Extract<
          PipelineAgentProposal,
          { mode: "generate" }
        >;
        const saved = await serviceBindings.db.transaction(async (tx) => {
          (0, serviceBindings.assertActivityActive)(sessionId, activity);
          const transactionalProposalsDao = createPipelineAgentProposalsDao(tx);
          const transactionalMessagesDao = createPipelineAgentMessagesDao(tx);
          const transactionalSessionsDao = createPipelineAgentSessionsDao(tx);
          const persistedProposal = await transactionalProposalsDao.create({
            id: crypto.randomUUID(),
            sessionId,
            mode: session.mode,
            status: "proposal_ready",
            proposal: generateProposal,
            approvedAt: null,
          });
          (0, serviceBindings.assertActivityActive)(sessionId, activity);
          await transactionalMessagesDao.create({
            id: crypto.randomUUID(),
            sessionId,
            role: "assistant",
            kind: "proposal_summary",
            content: generateProposal.assistantReply ?? generateProposal.purpose,
          });
          (0, serviceBindings.assertActivityActive)(sessionId, activity);
          await transactionalSessionsDao.update(sessionId, {
            latestProposalId: persistedProposal.id,
            status: "proposal_ready",
          });
          (0, serviceBindings.assertActivityActive)(sessionId, activity);

          return persistedProposal;
        });

        return {
          type: "proposal" as const,
          proposal: generateProposal,
          proposalId: saved.id,
        };
      })(),
      (error) => (error instanceof Error ? error : new Error(String(error))),
    );
    if (planningResult.isErr()) {
      await serviceBindings.sessionsDao.update(sessionId, {
        status: isCancellationError(planningResult.error) ? "awaiting_user" : "failed",
      });
      input?.signal?.removeEventListener("abort", handleExternalAbort);
      (0, serviceBindings.finishActivity)(sessionId, activity);
      throw planningResult.error;
    }

    input?.signal?.removeEventListener("abort", handleExternalAbort);
    (0, serviceBindings.finishActivity)(sessionId, activity);

    return planningResult.value;
  };
