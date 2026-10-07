import { ExecutionIdentifierSchema, type ExecutionPrincipal } from "@repo/schemas";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createApproveMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal, id: string) =>
    (0, serviceBindings.scoped)(principal, "execution:approve", (identity) =>
      serviceBindings.deps.repository.approve(identity, ExecutionIdentifierSchema.parse(id)),
    );
