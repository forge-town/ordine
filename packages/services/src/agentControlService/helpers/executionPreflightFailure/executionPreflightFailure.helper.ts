import type { ExecutionPreflightError } from "../executionPreflight";

export const failure = (
  code: string,
  message: string,
  retryable = true,
  field?: string,
): ExecutionPreflightError => ({ code, message, retryable, ...(field ? { field } : {}) });
