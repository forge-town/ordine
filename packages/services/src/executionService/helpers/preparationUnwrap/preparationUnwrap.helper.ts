import type { Result } from "neverthrow";

import type { ExecutionError } from "@repo/schemas";

import { ExecutionServiceFailure } from "../serviceResult";

export const unwrap = <T>(result: Result<T, ExecutionError>): T => {
  if (result.isErr()) throw new ExecutionServiceFailure(result.error);

  return result.value;
};
