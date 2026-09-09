export class ArtifactStoreError extends Error {
  readonly stage = "artifact" as const;
  readonly retryable = false;
  constructor(
    readonly code: string,
    message: string,
    readonly stagedArtifactId?: string,
  ) {
    super(message);
    this.name = "ArtifactStoreError";
  }
}

export const toArtifactStoreError = (error: unknown): ArtifactStoreError => {
  if (error instanceof ArtifactStoreError) return error;
  if (error instanceof Error && error.name === "AbortError")
    return new ArtifactStoreError("ARTIFACT_ABORTED", "Artifact operation was cancelled.");
  if (error instanceof Error && error.name === "ExecutionIdempotencyConflictError")
    return new ArtifactStoreError(
      "ARTIFACT_IMPORT_CONFLICT",
      "The import request ID already refers to different content.",
    );
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  if (code === "ENOENT")
    return new ArtifactStoreError("ARTIFACT_FILE_MISSING", "The artifact file is missing.");

  return new ArtifactStoreError("ARTIFACT_IO_FAILED", "Artifact storage operation failed.");
};

export const assertArtifactNotAborted = (signal?: AbortSignal): void => {
  if (signal?.aborted)
    throw new ArtifactStoreError("ARTIFACT_ABORTED", "Artifact operation was cancelled.");
};
