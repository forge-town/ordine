import { createPipelineAgentProposalsDao, createPipelineAgentSessionsDao } from "@repo/models";
import type { ObjectNodeType } from "@repo/schemas";

import { createPipelinesService } from "../../../pipelinesService";

import type { PipelineAgentSessionsServiceBindings } from "../../contracts";
export const createApproveProposalMethod =
  (serviceBindings: Pick<PipelineAgentSessionsServiceBindings, "db">) =>
  (sessionId: string, proposalId: string) =>
    serviceBindings.db.transaction(async (transaction) => {
      const transactionalSessionsDao = createPipelineAgentSessionsDao(transaction);
      const transactionalProposalsDao = createPipelineAgentProposalsDao(transaction);
      const transactionalPipelinesService = createPipelinesService(transaction);
      const session = await transactionalSessionsDao.findById(sessionId);
      if (!session) {
        throw new Error(`Pipeline agent session not found: ${sessionId}`);
      }

      const proposal = await transactionalProposalsDao.findById(proposalId);
      if (!proposal) {
        throw new Error(`Pipeline agent proposal not found: ${proposalId}`);
      }
      if (proposal.sessionId !== sessionId) {
        throw new Error(
          `Pipeline agent proposal ${proposalId} does not belong to session ${sessionId}`,
        );
      }
      if (proposal.mode !== session.mode) {
        throw new Error(
          `Pipeline agent proposal ${proposalId} mode does not match session ${sessionId}`,
        );
      }
      if (proposal.status !== "proposal_ready") {
        throw new Error(
          `Pipeline agent proposal ${proposalId} cannot be approved from status ${proposal.status}`,
        );
      }
      if (proposal.proposal.readiness !== "ready_for_generation") {
        throw new Error(`Pipeline agent proposal ${proposalId} is not ready for approval`);
      }

      if (proposal.proposal.mode === "edit") {
        if (proposal.proposal.pendingOperations?.length > 0) {
          const createPendingResult = await transactionalPipelinesService.createPendingOperations(
            proposal.proposal.pendingOperations.map((operation) => ({
              ...operation,
              acceptedObjectTypes: operation.acceptedObjectTypes as ObjectNodeType[],
            })),
          );
          if (createPendingResult.isErr()) throw createPendingResult.error;
        }

        const operationUpdates = (proposal.proposal.actions ?? []).flatMap((action) =>
          action.type === "updateOperation"
            ? [{ operationId: action.operationId, executor: action.executor }]
            : [],
        );
        if (operationUpdates.length > 0) {
          const editableOperationIds = new Set(
            (session.snapshot?.nodes ?? []).flatMap((node) =>
              node.data.nodeType === "operation" ? [node.data.operationId] : [],
            ),
          );
          const invalidUpdate = operationUpdates.find(
            (update) => !editableOperationIds.has(update.operationId),
          );
          if (invalidUpdate) {
            throw new Error(
              `Operation ${invalidUpdate.operationId} is not used by edit session ${sessionId}`,
            );
          }

          const updateResult =
            await transactionalPipelinesService.updateOperationExecutors(operationUpdates);
          if (updateResult.isErr()) throw updateResult.error;
        }
      }

      await transactionalProposalsDao.update(proposalId, {
        status: "approved",
        approvedAt: new Date(),
      });
      await transactionalSessionsDao.update(sessionId, {
        status: "approved",
        approvedProposalId: proposalId,
      });
    });
