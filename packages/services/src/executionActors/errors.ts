import type { ExecutionError } from "@repo/schemas";
import { ArtifactStoreError } from "../executionArtifacts";

export class ExecutionActorError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly stage: ExecutionError["stage"] = "execution",
    readonly field?: string,
  ) {
    super(message);
    this.name = "ExecutionActorError";
  }
}
export const actorError = (error: unknown): ExecutionError => ({
  code:
    error instanceof ExecutionActorError || error instanceof ArtifactStoreError
      ? error.code
      : "ACTOR_FAILED",
  message:
    error instanceof ExecutionActorError || error instanceof ArtifactStoreError
      ? error.message
      : "Execution actor failed unexpectedly.",
  stage:
    error instanceof ExecutionActorError || error instanceof ArtifactStoreError
      ? error.stage
      : "execution",
  retryable: false,
  ...(error instanceof ExecutionActorError && error.field ? { field: error.field } : {}),
});
