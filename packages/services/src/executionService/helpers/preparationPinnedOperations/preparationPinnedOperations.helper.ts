import { compileDefinitionGraph } from "@repo/pipeline-engine";
import type { OperationRevision, PipelineDefinition } from "@repo/schemas";

import { executionFailure } from "../serviceResult";

import { unwrap } from "../../helpers/preparationUnwrap";
import { supportedDefinition } from "../../helpers/preparationSupportedDefinition";

import type { ExecutionPreparationServiceBindings } from "../../contracts";
export const createPreparationPinnedOperationsHelper =
  (serviceBindings: Pick<ExecutionPreparationServiceBindings, "repository">) =>
  async (workspaceId: string, graph: PipelineDefinition["graph"]) => {
    const operations = new Map<string, OperationRevision>();
    for (const node of graph.nodes) {
      const key = `${node.operation.operationId}:${node.operation.revision}`;
      if (operations.has(key)) continue;
      const operation = await serviceBindings.repository.getOperationRevision(
        workspaceId,
        node.operation.operationId,
        node.operation.revision,
      );
      if (!operation)
        executionFailure(
          "NOT_FOUND",
          "A pinned Operation revision is unavailable",
          `nodes.${node.id}.operation`,
        );
      supportedDefinition(operation);
      operations.set(key, operation);
    }
    const revisions = [...operations.values()];
    unwrap(compileDefinitionGraph(graph, revisions));

    return revisions;
  };
