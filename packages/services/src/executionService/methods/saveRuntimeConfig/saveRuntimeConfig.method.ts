import { type ExecutionPrincipal, SaveExecutionRuntimeConfigSchema } from "@repo/schemas";

import { executionFailure } from "../../helpers/serviceResult";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createSaveRuntimeConfigMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal, value: unknown) =>
    (0, serviceBindings.scoped)(principal, "definitions:write", async (identity) => {
      const input = SaveExecutionRuntimeConfigSchema.parse(value);
      if (input.config.connection.mode !== "local")
        executionFailure(
          "RUNTIME_UNSUPPORTED",
          "This desktop release requires a local runtime",
          "config.connection",
        );
      const row = await serviceBindings.deps.repository.saveRuntimeConfig(
        identity.workspaceId,
        input.config,
        input.expectedRevision,
      );

      return { apiVersion: 2 as const, revision: row.revision, config: row.config };
    });
