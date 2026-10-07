import type { ResourceControlError } from "../resourceControl";

export const domainError = (
  code: string,
  message: string,
  retryable = false,
  field?: string,
): ResourceControlError => ({ code, message, retryable, ...(field ? { field } : {}) });
