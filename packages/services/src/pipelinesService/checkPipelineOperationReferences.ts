import type { createOperationsDao } from "@repo/models";
import type { PipelineNode, PipelineOperationReferenceDiagnostic } from "@repo/schemas";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { ServiceError } from "../serviceErrors";

export class PipelineOperationReferencesError extends Error {
  readonly code: PipelineOperationReferenceDiagnostic["code"];
  readonly pipelineId: string;
  readonly missingOperations: PipelineOperationReferenceDiagnostic["missingOperations"];

  constructor(diagnostic: PipelineOperationReferenceDiagnostic) {
    const references = diagnostic.missingOperations
      .map(({ nodeId, operationId }) => `"${operationId}" at node "${nodeId}"`)
      .join(", ");
    super(`Pipeline ${diagnostic.pipelineId} references missing Operation ${references}`);
    this.name = "PipelineOperationReferencesError";
    this.code = diagnostic.code;
    this.pipelineId = diagnostic.pipelineId;
    this.missingOperations = diagnostic.missingOperations;
  }
}

export const checkPipelineOperationReferences = ({
  nodes,
  operationsDao,
  pipelineId,
}: {
  nodes: readonly PipelineNode[];
  operationsDao: Pick<ReturnType<typeof createOperationsDao>, "findById">;
  pipelineId: string;
}): ResultAsync<void, PipelineOperationReferencesError | ServiceError> => {
  const references = nodes.flatMap((node) =>
    node.data.nodeType === "operation" && node.data.operationId
      ? [{ nodeId: node.id, operationId: node.data.operationId }]
      : [],
  );
  if (references.length === 0) return okAsync(undefined);

  const operationIds = [...new Set(references.map(({ operationId }) => operationId))];

  return ResultAsync.fromPromise(
    Promise.all(operationIds.map((operationId) => operationsDao.findById(operationId))),
    (cause) => new ServiceError(`Check Pipeline ${pipelineId} Operation references failed`, cause),
  ).andThen((operations) => {
    const existingOperationIds = new Set(
      operations.flatMap((operation) => (operation ? [operation.id] : [])),
    );
    const missingOperations = references.filter(
      ({ operationId }) => !existingOperationIds.has(operationId),
    );
    if (missingOperations.length === 0) return okAsync(undefined);

    return errAsync(
      new PipelineOperationReferencesError({
        code: "PIPELINE_OPERATION_MISSING",
        pipelineId,
        missingOperations,
      }),
    );
  });
};
