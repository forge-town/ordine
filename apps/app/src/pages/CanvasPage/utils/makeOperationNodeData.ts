import type { Operation, OperationNodeData } from "@repo/schemas";

export const makeOperationNodeData = (operation: Operation): OperationNodeData => ({
  label: operation.name,
  nodeType: "operation",
  operationId: operation.id,
  operationName: operation.name,
  status: "idle",
  config: {},
});
