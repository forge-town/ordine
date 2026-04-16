import type { OperationRecord } from "@repo/db-schema";
import type { OperationNodeData } from "./OperationNodeDataSchema";

export const makeOperationNodeData = (operation: OperationRecord): OperationNodeData => ({
  label: operation.name,
  nodeType: "operation",
  operationId: operation.id,
  operationName: operation.name,
  status: "idle",
  config: {},
});
