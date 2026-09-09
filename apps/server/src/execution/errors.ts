import { ExecutionErrorSchema, type ExecutionError } from "@repo/schemas";

export const executionError = (
  code: string,
  message: string,
  stage: ExecutionError["stage"] = "validation",
  retryable = false,
): ExecutionError => ExecutionErrorSchema.parse({ code, message, stage, retryable });

/** Service errors are domain DTOs. Unexpected exceptions never cross the HTTP boundary. */
export const executionErrorStatus = (
  error: ExecutionError,
): 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503 => {
  if (/UNAUTHORIZED|UNAUTHENTICATED/.test(error.code)) return 401;
  if (/FORBIDDEN|SCOPE|PERMISSION|APPROVAL_AUTHORITY|DENIED/.test(error.code)) return 403;
  if (/NOT_FOUND/.test(error.code)) return 404;
  if (/CONFLICT|REVISION|ALREADY|EXPIRED|STATE|NOT_PENDING/.test(error.code)) return 409;
  if (/TOO_LARGE|SIZE_LIMIT/.test(error.code)) return 413;
  if (/CAPACITY_EXCEEDED/.test(error.code)) return 429;
  if (/UNAVAILABLE|TIMEOUT|SERVICE_FAILED|DRAINING/.test(error.code)) return 503;
  if (/INTERNAL|DATABASE|PERSISTENCE|STORAGE|IO_FAILED/.test(error.code)) return 500;

  return 400;
};

export const publicExecutionError = (value: unknown): ExecutionError => {
  const parsed = ExecutionErrorSchema.safeParse(value);
  if (!parsed.success)
    return executionError(
      "EXECUTION_INTERNAL_ERROR",
      "Execution request could not be completed.",
      "execution",
      true,
    );
  const error = parsed.data;
  const containsPrivateDetail =
    /(?:[A-Za-z]:[\\/]|(?:^|\s)\/[^\s]+|\b(?:Bearer|password|secret|token)\s*[=: ]|\n\s*at\s)/iu.test(
      `${error.message}\n${error.field ?? ""}`,
    );

  return containsPrivateDetail
    ? {
        ...error,
        field: undefined,
        message: "Execution request could not be completed; inspect server diagnostics.",
      }
    : error;
};
