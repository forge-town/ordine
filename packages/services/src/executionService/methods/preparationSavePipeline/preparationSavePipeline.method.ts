import { SavePipelineDefinitionSchema, type ExecutionPrincipal } from "@repo/schemas";

import { executionServiceResult, requireExecutionScope } from "../../helpers/serviceResult";

import type { ExecutionPreparationServiceBindings } from "../../contracts";
export const createPreparationSavePipelineMethod = (
  serviceBindings: Pick<ExecutionPreparationServiceBindings, "pinnedOperations" | "repository">,
) =>
  ({
    savePipeline(principalInput: ExecutionPrincipal, value: unknown) {
      return executionServiceResult(async () => {
        const principal = requireExecutionScope(principalInput, "definitions:write");
        const input = SavePipelineDefinitionSchema.parse(value);
        await (0, serviceBindings.pinnedOperations)(principal.workspaceId, input.definition.graph);

        return serviceBindings.repository.savePipeline(principal.workspaceId, input);
      });
    },
  }).savePipeline;
