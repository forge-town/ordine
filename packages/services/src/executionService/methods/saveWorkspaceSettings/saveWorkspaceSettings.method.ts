import { type ExecutionPrincipal, SaveExecutionWorkspaceSettingsSchema } from "@repo/schemas";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createSaveWorkspaceSettingsMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal, value: unknown) =>
    (0, serviceBindings.scoped)(principal, "definitions:write", async (identity) => {
      const input = SaveExecutionWorkspaceSettingsSchema.parse(value);
      const row = await serviceBindings.deps.repository.saveWorkspaceSettings(
        identity.workspaceId,
        input.executionDefaults,
        input.expectedRevision,
      );

      return {
        apiVersion: 2 as const,
        revision: row.revision,
        executionDefaults: row.executionDefaults,
      };
    });
