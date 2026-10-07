import type { ExecutionError } from "@repo/schemas";

export const stopped = (): ExecutionError => ({
  code: "CANCELLED",
  message: "Process admission was cancelled",
  retryable: false,
  stage: "execution",
});
