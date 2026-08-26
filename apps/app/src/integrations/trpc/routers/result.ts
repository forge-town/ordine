import { TRPCError } from "@trpc/server";
import type { Result } from "neverthrow";

const codeForError = (error: unknown) => {
  if (
    error instanceof Error &&
    (error.name === "CapabilityCatalogValidationError" ||
      error.name === "OperationConfigValidationError")
  ) {
    return "BAD_REQUEST";
  }
  if (error instanceof Error && error.name.endsWith("NotFoundError")) return "NOT_FOUND";
  if (error instanceof Error && error.name === "PipelineOperationReferencesError") {
    return "CONFLICT";
  }
  if (error instanceof Error && error.name.endsWith("ConflictError")) return "CONFLICT";
  if (error instanceof Error && error.name === "InvalidJobStatusError") return "CONFLICT";

  return "INTERNAL_SERVER_ERROR";
};

export const unwrapResult = <T>(result: Result<T, unknown>): T => {
  if (result.isOk()) return result.value;

  const error = result.error;
  throw new TRPCError({
    code: codeForError(error),
    message: error instanceof Error ? error.message : "Request failed",
  });
};
