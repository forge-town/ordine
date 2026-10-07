import type { ExecutionPrincipal } from "@repo/schemas";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createListPipelinesMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal) =>
    (0, serviceBindings.scoped)(principal, "definitions:read", (identity) =>
      serviceBindings.deps.repository.listPipelines(identity.workspaceId),
    );
