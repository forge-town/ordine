import type { OperationNodeData, PipelineAction, PipelineActionDiagnostic } from "@repo/schemas";

const makeProposalDiagnostic = (
  code: PipelineActionDiagnostic["code"],
  message: string,
  actionIndex: number,
): PipelineActionDiagnostic => ({
  code,
  message,
  actionIndex,
  severity: "error",
});

const validateOperationNodeCatalog = (
  nodeId: string,
  data: OperationNodeData,
  operationById: Map<string, { name: string }>,
  actionIndex: number,
): PipelineActionDiagnostic[] => {
  const catalogOperation = operationById.get(data.operationId);
  if (!catalogOperation) {
    return [
      makeProposalDiagnostic(
        "INVALID_NODE_DATA",
        `Operation node "${nodeId}" references unknown operationId "${data.operationId}".`,
        actionIndex,
      ),
    ];
  }

  if (catalogOperation.name !== data.operationName) {
    return [
      makeProposalDiagnostic(
        "INVALID_NODE_DATA",
        `Operation node "${nodeId}" operationName must match operation "${data.operationId}" (${catalogOperation.name}).`,
        actionIndex,
      ),
    ];
  }

  return [];
};

export const validateProposalActionCatalog = (
  actions: PipelineAction[],
  operationById: Map<string, { name: string }>,
): PipelineActionDiagnostic[] =>
  actions.flatMap((action, actionIndex) => {
    if (action.type === "addNode" && action.node.data.nodeType === "operation") {
      return validateOperationNodeCatalog(
        action.node.id,
        action.node.data,
        operationById,
        actionIndex,
      );
    }

    if (action.type === "replaceNodeData" && action.data.nodeType === "operation") {
      return validateOperationNodeCatalog(action.nodeId, action.data, operationById, actionIndex);
    }

    return [];
  });
