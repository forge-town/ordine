import { ExecutionRequestIdSchema, type ExecutionPrincipal } from "@repo/schemas";

import { executionFailure } from "../../helpers/serviceResult";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createGetRequestMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal, requestId: string) =>
    (0, serviceBindings.scoped)(principal, "execution:read", async (identity) => {
      const receipt = await serviceBindings.deps.repository.findRequest(
        identity,
        ExecutionRequestIdSchema.parse(requestId),
      );
      if (!receipt) executionFailure("NOT_FOUND", "RunRequest was not found");

      return receipt;
    });
