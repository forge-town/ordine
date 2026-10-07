import type { ExecutionError } from "@repo/schemas";

export const attemptState = (error: ExecutionError) =>
  /TERMINATION_FAILED|LEASE_LOST/u.test(error.code)
    ? ("interrupted" as const)
    : /TIMEOUT|TIMED_OUT|DEADLINE/u.test(error.code)
      ? ("timed_out" as const)
      : /CANCEL|ABORT/u.test(error.code)
        ? ("cancelled" as const)
        : ("failed" as const);
