import "../../../text-imports.d.ts";

import { ResultAsync } from "neverthrow";

import { NotFoundError, toServiceError } from "../../../serviceErrors";

import {
  checkPipelineOperationReferences,
  PipelineOperationReferencesError,
} from "../../helpers/checkPipelineOperationReferences/checkPipelineOperationReferences.helper";

import type { PipelinesServiceBindings } from "../../contracts";
export const createUpdateMethod =
  (serviceBindings: Pick<PipelinesServiceBindings, "dao" | "operationRegistryRepository">) =>
  (id: string, patch: Parameters<typeof serviceBindings.dao.update>[1]) =>
    ResultAsync.fromPromise(
      serviceBindings.operationRegistryRepository.runSerializable(
        async ({ operationsDao, pipelinesDao }) => {
          const pipeline = await pipelinesDao.findById(id);
          if (!pipeline) throw new NotFoundError("Pipeline", id);

          const referenceCheck = await checkPipelineOperationReferences({
            nodes: patch.nodes ?? pipeline.nodes ?? [],
            operationsDao,
            pipelineId: id,
          });
          if (referenceCheck.isErr()) throw referenceCheck.error;

          return pipelinesDao.update(id, patch);
        },
      ),
      (error) =>
        error instanceof PipelineOperationReferencesError || error instanceof NotFoundError
          ? error
          : toServiceError(error, "Update Pipeline"),
    );
