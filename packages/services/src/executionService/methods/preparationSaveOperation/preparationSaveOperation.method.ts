import { SaveOperationRevisionSchema, type ExecutionPrincipal } from "@repo/schemas";

import { executionServiceResult, requireExecutionScope } from "../../helpers/serviceResult";

import { supportedDefinition } from "../../helpers/preparationSupportedDefinition";

import type { ExecutionPreparationServiceBindings } from "../../contracts";
export const createPreparationSaveOperationMethod = (
  serviceBindings: Pick<ExecutionPreparationServiceBindings, "repository">,
) =>
  ({
    saveOperation(principalInput: ExecutionPrincipal, value: unknown) {
      return executionServiceResult(async () => {
        const principal = requireExecutionScope(principalInput, "definitions:write");
        const input = SaveOperationRevisionSchema.parse(value);
        supportedDefinition(input.operation);

        return serviceBindings.repository.saveOperation(
          principal.workspaceId,
          input.operation,
          input.expectedRevision,
        );
      });
    },
  }).saveOperation;
