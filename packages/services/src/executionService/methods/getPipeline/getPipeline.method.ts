import { ExecutionIdentifierSchema, type ExecutionPrincipal } from "@repo/schemas";

import { executionFailure } from "../../helpers/serviceResult";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createGetPipelineMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal, id: string) =>
    (0, serviceBindings.scoped)(principal, "definitions:read", async (identity) => {
      const pipeline = await serviceBindings.deps.repository.getPipeline(
        identity.workspaceId,
        ExecutionIdentifierSchema.parse(id),
      );
      if (!pipeline) executionFailure("NOT_FOUND", "Pipeline was not found");

      return pipeline;
    });
