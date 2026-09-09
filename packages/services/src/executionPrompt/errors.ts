import { Result, type Result as Outcome } from "neverthrow";
import type { ExecutionError } from "@repo/schemas";
export class ExecutionPromptError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly stage: ExecutionError["stage"] = "execution",
  ) {
    super(message);
    this.name = "ExecutionPromptError";
  }
}
export const promptError = (error: unknown): ExecutionError => ({
  code: error instanceof ExecutionPromptError ? error.code : "PROMPT_EXECUTION_FAILED",
  message: error instanceof ExecutionPromptError ? error.message : "Prompt execution failed.",
  stage: error instanceof ExecutionPromptError ? error.stage : "execution",
  retryable: false,
});
export const requirePromptResult = <T, E>(result: Outcome<T, E>): T => {
  if (result.isErr()) throw result.error;

  return result.value;
};
export const parsePromptJson = (text: string): unknown =>
  requirePromptResult(
    Result.fromThrowable(
      () => JSON.parse(text) as unknown,
      () => new ExecutionPromptError("PROMPT_JSON_INVALID", "Runtime output is not valid JSON."),
    )(),
  );
