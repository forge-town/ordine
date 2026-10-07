import type { ResourceControlError } from "../resourceControl";
import { domainError } from "../resourceControlDomainError";

export const toError = (error: unknown, fallback: string): ResourceControlError =>
  domainError(
    "RESOURCE_OPERATION_FAILED",
    error instanceof Error ? error.message : fallback,
    false,
  );
