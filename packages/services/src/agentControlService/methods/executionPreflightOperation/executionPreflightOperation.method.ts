import type { Result } from "neverthrow";

import type {
  ExecutionPreflightError,
  ExecutionPreflightValue,
} from "../../helpers/executionPreflight";

import type { ExecutionPreflightBindings } from "../../contracts";
export const createExecutionPreflightOperationMethod = (
  serviceBindings: Pick<ExecutionPreflightBindings, "inspectOperations">,
) =>
  ({
    async operation(
      operationId: string,
    ): Promise<Result<ExecutionPreflightValue, ExecutionPreflightError>> {
      return (0, serviceBindings.inspectOperations)([operationId]);
    },
  }).operation;
