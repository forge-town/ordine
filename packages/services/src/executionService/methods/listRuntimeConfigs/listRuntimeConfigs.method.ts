import type { ExecutionPrincipal } from "@repo/schemas";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createListRuntimeConfigsMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal) =>
    (0, serviceBindings.scoped)(principal, "definitions:read", async (identity) => {
      const rows = await serviceBindings.deps.repository.listRuntimeConfigs(identity.workspaceId);

      return rows.map((row) => ({
        apiVersion: 2 as const,
        revision: row.revision,
        config: row.config,
      }));
    });
