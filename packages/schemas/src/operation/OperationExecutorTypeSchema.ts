import { z } from "zod/v4";

export const OPERATION_EXECUTOR_TYPE_ENUM = {
  AGENT: "agent",
  SCRIPT: "script",
} as const;

export const OperationExecutorTypeSchema = z.enum(OPERATION_EXECUTOR_TYPE_ENUM);
export type OperationExecutorType = z.infer<typeof OperationExecutorTypeSchema>;
