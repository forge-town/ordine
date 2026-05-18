import { z } from "zod/v4";

export const OPERATION_NODE_TYPE_ENUM = {
  OPERATION: "operation",
  COMPOUND: "compound",
} as const;
export const OperationNodeTypeSchema = z.enum(OPERATION_NODE_TYPE_ENUM);
export type OperationNodeType = z.infer<typeof OperationNodeTypeSchema>;
