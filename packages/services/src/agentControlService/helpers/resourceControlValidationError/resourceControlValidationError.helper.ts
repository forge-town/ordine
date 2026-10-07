import type { z } from "zod/v4";

import type { ResourceControlError } from "../resourceControl";
import { domainError } from "../resourceControlDomainError";

export const validationError = (error: z.ZodError): ResourceControlError => {
  const issue = error.issues[0];

  return domainError(
    "INVALID_RESOURCE_FIELDS",
    issue?.message ?? "Resource fields are invalid",
    true,
    issue?.path.join(".") || undefined,
  );
};
