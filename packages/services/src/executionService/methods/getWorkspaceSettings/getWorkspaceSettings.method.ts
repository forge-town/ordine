import type { ExecutionPrincipal } from "@repo/schemas";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createGetWorkspaceSettingsMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal) =>
    (0, serviceBindings.scoped)(principal, "definitions:read", async (identity) => {
      const row = await serviceBindings.deps.repository.getWorkspaceSettings(identity.workspaceId);

      return {
        apiVersion: 2 as const,
        revision: row?.revision ?? 0,
        executionDefaults: row?.executionDefaults ?? {},
      };
    });
