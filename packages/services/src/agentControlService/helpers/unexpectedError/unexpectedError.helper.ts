import type { DomainError } from "../../contracts";

export const unexpectedError = (error: unknown): DomainError => ({
  code: "AGENT_CONTROL_INTERNAL_ERROR",
  message: error instanceof Error ? error.message : "Agent Control failed unexpectedly",
  retryable: false,
});
