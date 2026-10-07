import {
  createPipelineAgentMessagesDao,
  createPipelineAgentProposalsDao,
  createPipelineAgentSessionsDao,
} from "@repo/models";
import { PipelineAgentPlanningResultSchema, type PipelineAgentProposal } from "@repo/schemas";

import { parsePlanningResult } from "../parsePlanningResult/parsePlanningResult.helper";

import {
  PIPELINE_AGENT_PROJECTION_AGENT_ID,
  RelaxedCanvasEditPlanningResultSchema,
  type RelaxedCanvasEditPlanningResult,
  type PipelineAgentSessionsServiceBindings,
} from "../../contracts";

import { createCancellationError } from "../createCancellationError";

export const createPersistPlanningOutputHelper =
  (
    serviceBindings: Pick<
      PipelineAgentSessionsServiceBindings,
      "sessionsDao" | "db" | "pipelinesService"
    >,
  ) =>
  async (
    sessionId: string,
    raw: string,
    options: {
      runtimeId?: string;
      model?: string;
      reasoningEffort?: string;
      speed?: string;
      firstOutputTimeoutMs?: number;
      signal?: AbortSignal;
    } = {},
  ): Promise<
    | { type: "question"; question: string }
    | { type: "proposal"; proposal: PipelineAgentProposal; proposalId: string }
  > => {
    if (options.signal?.aborted) throw createCancellationError(sessionId);
    const session = await serviceBindings.sessionsDao.findById(sessionId);
    if (!session) throw new Error(`Pipeline agent session not found: ${sessionId}`);
    const parsed =
      session.mode === "edit"
        ? parsePlanningResult(raw, RelaxedCanvasEditPlanningResultSchema)
        : parsePlanningResult(raw, PipelineAgentPlanningResultSchema);

    if (parsed.type === "question") {
      if (options.signal?.aborted) throw createCancellationError(sessionId);
      await serviceBindings.db.transaction(async (transaction) => {
        await createPipelineAgentMessagesDao(transaction).create({
          id: crypto.randomUUID(),
          sessionId,
          role: "assistant",
          kind: "question",
          content: parsed.question,
        });
        await createPipelineAgentSessionsDao(transaction).update(sessionId, {
          status: "awaiting_user",
        });
      });

      return parsed;
    }

    if (parsed.proposal.readiness !== "ready_for_generation") {
      const question =
        parsed.proposal.openQuestions
          .map((item) => item.trim())
          .filter(Boolean)
          .join("\n") || "Please provide the missing details before I continue.";
      if (options.signal?.aborted) throw createCancellationError(sessionId);
      await serviceBindings.db.transaction(async (transaction) => {
        await createPipelineAgentMessagesDao(transaction).create({
          id: crypto.randomUUID(),
          sessionId,
          role: "assistant",
          kind: "question",
          content: question,
        });
        await createPipelineAgentSessionsDao(transaction).update(sessionId, {
          status: "awaiting_user",
        });
      });

      return { type: "question", question };
    }

    const proposal: PipelineAgentProposal =
      session.mode === "edit"
        ? await (async () => {
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
            const actionProposalResult = await serviceBindings.pipelinesService.proposeActions({
              snapshot: session.snapshot,
              message: actionRequest,
              pipelineId: session.pipelineId ?? undefined,
              runtimeId: options.runtimeId,
              model: options.model,
              reasoningEffort: options.reasoningEffort,
              speed: options.speed,
              firstOutputTimeoutMs: options.firstOutputTimeoutMs,
              jobId: sessionId,
              agentId: PIPELINE_AGENT_PROJECTION_AGENT_ID,
              signal: options.signal,
            });
            if (options.signal?.aborted) throw createCancellationError(sessionId);
            if (!actionProposalResult.proposal) {
              throw new Error("Failed to generate executable canvas edit actions");
            }

            return {
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
          })()
        : (parsed.proposal as Extract<PipelineAgentProposal, { mode: "generate" }>);

    if (options.signal?.aborted) throw createCancellationError(sessionId);
    const saved = await serviceBindings.db.transaction(async (transaction) => {
      const persistedProposal = await createPipelineAgentProposalsDao(transaction).create({
        id: crypto.randomUUID(),
        sessionId,
        mode: session.mode,
        status: "proposal_ready",
        proposal,
        approvedAt: null,
      });
      await createPipelineAgentMessagesDao(transaction).create({
        id: crypto.randomUUID(),
        sessionId,
        role: "assistant",
        kind: "proposal_summary",
        content:
          proposal.assistantReply ??
          (proposal.mode === "generate" ? proposal.purpose : proposal.summary),
      });
      await createPipelineAgentSessionsDao(transaction).update(sessionId, {
        latestProposalId: persistedProposal.id,
        status: "proposal_ready",
      });

      return persistedProposal;
    });

    return { type: "proposal", proposal, proposalId: saved.id };
  };
