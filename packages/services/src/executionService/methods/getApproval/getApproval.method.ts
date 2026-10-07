import {
  ExecutionApprovalSchema,
  ExecutionIdentifierSchema,
  type ExecutionPrincipal,
} from "@repo/schemas";

import { executionFailure } from "../../helpers/serviceResult";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createGetApprovalMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal, id: string) =>
    (0, serviceBindings.scoped)(principal, "execution:read", async (identity) => {
      const approval = await serviceBindings.deps.repository.getApproval(
        identity,
        ExecutionIdentifierSchema.parse(id),
      );
      if (!approval) executionFailure("NOT_FOUND", "Approval was not found");

      return ExecutionApprovalSchema.parse(approval);
    });
