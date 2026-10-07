import type { PipelineAction } from "@repo/schemas";

/**
 * Auto-correct operationName on operation nodes: whenever operationId hits
 * the catalog (including agent-drafted pending operations), rewrite
 * operationName to the catalog name. LLMs frequently get the display name
 * slightly wrong while the id is correct; without this fix such proposals
 * would be blocked by an error-level catalog diagnostic. Only nodes that
 * still mismatch after this rewrite (unknown operationId) produce
 * diagnostics downstream.
 */
export const normalizeProposalActionCatalogNames = (
  actions: PipelineAction[],
  operationById: Map<string, { name: string }>,
): PipelineAction[] =>
  actions.map((action) => {
    if (action.type === "addNode" && action.node.data.nodeType === "operation") {
      const catalogOperation = operationById.get(action.node.data.operationId);
      if (!catalogOperation) {
        return action;
      }

      return {
        ...action,
        node: {
          ...action.node,
          data: {
            ...action.node.data,
            operationName: catalogOperation.name,
          },
        },
      };
    }

    if (action.type === "replaceNodeData" && action.data.nodeType === "operation") {
      const catalogOperation = operationById.get(action.data.operationId);
      if (!catalogOperation) {
        return action;
      }

      return {
        ...action,
        data: {
          ...action.data,
          operationName: catalogOperation.name,
        },
      };
    }

    return action;
  });
