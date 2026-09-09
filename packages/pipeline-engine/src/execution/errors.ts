import type { ExecutionError } from "@repo/schemas";

export const executionError = (
  code: string,
  message: string,
  context: Partial<Omit<ExecutionError, "code" | "message" | "retryable">> = {},
): ExecutionError => ({ code, message, retryable: false, stage: "validation", ...context });
