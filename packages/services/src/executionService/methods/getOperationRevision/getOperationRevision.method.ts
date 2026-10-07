import { ExecutionIdentifierSchema, type ExecutionPrincipal } from "@repo/schemas";

import { executionFailure } from "../../helpers/serviceResult";

import type { ExecutionApiServiceBindings } from "../../contracts";
export const createGetOperationRevisionMethod =
  (serviceBindings: Pick<ExecutionApiServiceBindings, "scoped" | "deps">) =>
  (principal: ExecutionPrincipal, id: string, revision: number) =>
    (0, serviceBindings.scoped)(principal, "definitions:read", async (identity) => {
      if (!Number.isSafeInteger(revision) || revision < 1)
        executionFailure(
          "INVALID_INPUT",
          "Operation revision must be positive",
          "revision",
          "validation",
        );
      const operation = await serviceBindings.deps.repository.getOperationRevision(
        identity.workspaceId,
        ExecutionIdentifierSchema.parse(id),
        revision,
      );
      if (!operation) executionFailure("NOT_FOUND", "Operation revision was not found");

      return operation;
    });
