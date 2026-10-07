import { err, ok, type Result } from "neverthrow";

import type { ResourceControlError } from "../resourceControl";
import { domainError } from "../resourceControlDomainError";

export const parseOffset = (cursor?: string): Result<number, ResourceControlError> => {
  if (!cursor) return ok(0);
  const value = Number.parseInt(cursor, 10);

  return Number.isSafeInteger(value) && value >= 0
    ? ok(value)
    : err(domainError("INVALID_CURSOR", "cursor must be a non-negative integer", true, "cursor"));
};
