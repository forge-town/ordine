import type { PipelineAction, PipelineActionDiagnostic } from "@repo/schemas";

/**
 * After screenNewOperations drops drafted operations that violate the id
 * contract, any action that still references a rejected id would otherwise be
 * silently rewritten to an existing catalog operation by
 * normalizeProposalActionCatalogNames. This helper turns those references into
 * error-level diagnostics so the Apply button is disabled.
 */
export const validateRejectedOperationReferences = (
  actions: PipelineAction[],
  rejectedIds: string[],
): PipelineActionDiagnostic[] => {
  if (rejectedIds.length === 0) {
    return [];
  }

  const rejectedSet = new Set(rejectedIds);
  const diagnostics: PipelineActionDiagnostic[] = [];

  for (const [actionIndex, action] of actions.entries()) {
    const operationId =
      action.type === "addNode" && action.node.data.nodeType === "operation"
        ? action.node.data.operationId
        : action.type === "replaceNodeData" && action.data.nodeType === "operation"
          ? action.data.operationId
          : action.type === "updateOperation"
            ? action.operationId
            : undefined;

    if (operationId && rejectedSet.has(operationId)) {
      diagnostics.push({
        actionIndex,
        code: "INVALID_NODE_DATA",
        message: `Operation node references rejected drafted operation "${operationId}". The drafted operation collided with the catalog and cannot be applied.`,
        severity: "error",
      });
    }
  }

  return diagnostics;
};
