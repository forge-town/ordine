import "../../../text-imports.d.ts";

import { ResultAsync } from "neverthrow";

import { toServiceError } from "../../../serviceErrors";

import {
  checkPipelineOperationReferences,
  PipelineOperationReferencesError,
} from "../../helpers/checkPipelineOperationReferences/checkPipelineOperationReferences.helper";

import type { PendingOperationInput } from "../../pipelines.service";

import type { PipelinesServiceBindings } from "../../contracts";
export const createCreateWithPendingOperationsMethod =
  (
    serviceBindings: Pick<
      PipelinesServiceBindings,
      "dao" | "operationRegistryRepository" | "insertPendingOperations"
    >,
  ) =>
  (
    pipeline: Parameters<typeof serviceBindings.dao.create>[0],
    pendingOperations: PendingOperationInput[],
  ) =>
    ResultAsync.fromPromise(
      serviceBindings.operationRegistryRepository.runSerializable(async (transaction) => {
        await (0, serviceBindings.insertPendingOperations)(transaction.executor, pendingOperations);

        const referenceCheck = await checkPipelineOperationReferences({
          nodes: pipeline.nodes ?? [],
          operationsDao: transaction.operationsDao,
          pipelineId: pipeline.id,
        });
        if (referenceCheck.isErr()) throw referenceCheck.error;

        return transaction.pipelinesDao.create(pipeline);
      }),
      (error) =>
        error instanceof PipelineOperationReferencesError
          ? error
          : toServiceError(error, "Create pipeline with pending operations"),
    );
