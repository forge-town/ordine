import { z } from "zod/v4";

export const EXECUTOR_TYPE_ENUM = {
  AGENT: "agent",
  SCRIPT: "script",
  RULE_CHECK: "rule-check",
} as const;

export const ExecutorTypeSchema = z.enum(EXECUTOR_TYPE_ENUM);
export type ExecutorType = z.infer<typeof ExecutorTypeSchema>;
