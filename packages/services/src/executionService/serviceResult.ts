import { ResultAsync } from "neverthrow";
import { z } from "zod/v4";
import {
  ExecutionErrorSchema,
  ExecutionPrincipalSchema,
  type ExecutionError,
  type ExecutionPrincipal,
  type ExecutionScope,
} from "@repo/schemas";
import { ArtifactStoreError } from "../executionArtifacts/errors";
import { ExecutionPromptError } from "../executionPrompt/errors";

export class ExecutionServiceFailure extends Error {
  constructor(readonly detail: ExecutionError) {
    super(detail.message);
    this.name = "ExecutionServiceFailure";
  }
}

export const executionFailure: (
  code: string,
  message: string,
  field?: string,
  stage?: ExecutionError["stage"],
) => never = (
  code: string,
  message: string,
  field?: string,
  stage: ExecutionError["stage"] = "preparation",
): never => {
  throw new ExecutionServiceFailure(
    ExecutionErrorSchema.parse({
      code,
      message,
      retryable: false,
      stage,
      ...(field ? { field } : {}),
    }),
  );
};

const repositoryErrors = new Set([
  "ExecutionIntegrityError",
  "ExecutionRevisionConflictError",
  "ExecutionIdempotencyConflictError",
  "ExecutionNotFoundError",
  "ExecutionApprovalExpiredError",
  "ExecutionDecisionConflictError",
  "ExecutionScopeError",
  "ExecutionLeaseLostError",
  "ExecutionJobStateConflictError",
  "ExecutionJobDeadlineError",
  "ExecutionCapacityError",
]);

export const toExecutionServiceError = (error: unknown): ExecutionError => {
  if (error instanceof ExecutionServiceFailure) return error.detail;
  if (error instanceof ExecutionPromptError)
    return { code: error.code, message: error.message, retryable: false, stage: error.stage };
  if (error instanceof ArtifactStoreError)
    return { code: error.code, message: error.message, retryable: false, stage: "artifact" };
  if (
    error instanceof Error &&
    repositoryErrors.has(error.name) &&
    "code" in error &&
    typeof error.code === "string"
  )
    return {
      code: error.code,
      message: error.message,
      retryable: "retryable" in error && error.retryable === true,
      stage:
        error.name === "ExecutionScopeError"
          ? "authentication"
          : /Approval|Decision/u.test(error.name)
            ? "approval"
            : /Job|Lease/u.test(error.name)
              ? "execution"
              : "preparation",
    };
  if (error instanceof z.ZodError)
    return {
      code: "INVALID_INPUT",
      message: "Input does not match the execution contract",
      retryable: false,
      stage: "validation",
      field: error.issues[0]?.path.join(".") || "input",
    };

  return {
    code: "EXECUTION_SERVICE_FAILED",
    message: "Execution storage or preparation is unavailable",
    retryable: true,
    stage: "preparation",
  };
};

export const executionServiceResult = <T>(
  operation: () => Promise<T>,
): ResultAsync<T, ExecutionError> =>
  ResultAsync.fromPromise(Promise.resolve().then(operation), toExecutionServiceError);

export const requireExecutionScope = (
  input: ExecutionPrincipal,
  scope: ExecutionScope,
): ExecutionPrincipal => {
  const principal = ExecutionPrincipalSchema.parse(input);
  if (!principal.scopes.includes(scope))
    executionFailure("FORBIDDEN", `Missing execution scope: ${scope}`, undefined, "authentication");

  return principal;
};
