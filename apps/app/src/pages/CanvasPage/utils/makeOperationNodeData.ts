import type { Operation } from "@repo/schemas";
import type { OperationNodeData } from "@repo/pipeline-engine/schemas";

export const makeOperationNodeData = (operation: Operation): OperationNodeData => ({
  label: operation.name,
  nodeType: "operation",
  operationId: operation.id,
  operationName: operation.name,
  status: "idle",
  config: {},
});
