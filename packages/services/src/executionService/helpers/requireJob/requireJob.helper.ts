import { ExecutionIdentifierSchema, type ExecutionPrincipal } from "@repo/schemas";

import { executionFailure } from "../serviceResult";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createRequireJobHelper =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "deps">) =>
  async (identity: ExecutionPrincipal, id: string) => {
    const row = await serviceBindings.deps.repository.getJob(
      identity,
      ExecutionIdentifierSchema.parse(id),
    );
    if (!row) executionFailure("NOT_FOUND", "Job was not found");

    return row;
  };
