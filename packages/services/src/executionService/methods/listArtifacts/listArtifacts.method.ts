import { ExecutionIdentifierSchema, type ExecutionPrincipal } from "@repo/schemas";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createListArtifactsMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal, id: string) =>
    (0, serviceBindings.scoped)(principal, "artifacts:read", async (identity) => {
      const rows = await serviceBindings.deps.jobs.listArtifacts(
        identity,
        ExecutionIdentifierSchema.parse(id),
      );

      return rows.map((row) => row.metadata);
    });
