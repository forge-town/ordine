import { TRPCError } from "@trpc/server";
import type { Result } from "neverthrow";
import { ConflictError, NotFoundError } from "@repo/services";

const codeForError = (error: unknown) => {
  if (error instanceof NotFoundError) return "NOT_FOUND";
  if (error instanceof ConflictError) return "CONFLICT";

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
