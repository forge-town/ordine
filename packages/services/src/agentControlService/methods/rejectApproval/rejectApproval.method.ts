import type { AgentResourceRef } from "@repo/schemas";

import type { DomainError, AgentControlServiceBindings } from "../../contracts";

import { toPublicApproval } from "../../helpers/toPublicApproval";

export const createRejectApprovalMethod = (
  serviceBindings: Pick<AgentControlServiceBindings, "approvalsDao" | "persistFailure">,
) =>
  ({
    async rejectApproval(approvalId: string) {
      const approval = await serviceBindings.approvalsDao.reject(approvalId);
      if (!approval) return null;
      const error = {
        code: "APPROVAL_REJECTED",
        message: "The irreversible action was rejected; no domain data was changed.",
        retryable: false,
      } satisfies DomainError;
      await (0, serviceBindings.persistFailure)({
        actionId: approval.actionId,
        toolName: approval.toolName,
        runId: approval.runId,
        error,
        resources:
          approval.targetType && approval.targetId
            ? [{ type: approval.targetType as AgentResourceRef["type"], id: approval.targetId }]
            : [],
      });

      return toPublicApproval(approval);
    },
  }).rejectApproval;
