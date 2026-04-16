import { z } from "zod/v4";

export const OperationNodeTypeSchema = z.literal("operation");
export type OperationNodeType = z.infer<typeof OperationNodeTypeSchema>;

export const OPERATION_TYPE: OperationNodeType = "operation";
