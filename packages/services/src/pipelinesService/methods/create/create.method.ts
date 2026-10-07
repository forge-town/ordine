import "../../../text-imports.d.ts";

import { ResultAsync } from "neverthrow";

import { toServiceError } from "../../../serviceErrors";

import {
  checkPipelineOperationReferences,
  PipelineOperationReferencesError,
} from "../../helpers/checkPipelineOperationReferences/checkPipelineOperationReferences.helper";

import type { PipelinesServiceBindings } from "../../contracts";
export const createCreateMethod =
  (serviceBindings: Pick<PipelinesServiceBindings, "dao" | "operationRegistryRepository">) =>
  (pipeline: Parameters<typeof serviceBindings.dao.create>[0]) =>
    ResultAsync.fromPromise(
      serviceBindings.operationRegistryRepository.runSerializable(
        async ({ operationsDao, pipelinesDao }) => {
          const referenceCheck = await checkPipelineOperationReferences({
            nodes: pipeline.nodes ?? [],
            operationsDao,
            pipelineId: pipeline.id,
          });
          if (referenceCheck.isErr()) throw referenceCheck.error;

          return pipelinesDao.create(pipeline);
        },
      ),
      (error) =>
        error instanceof PipelineOperationReferencesError
          ? error
          : toServiceError(error, "Create Pipeline"),
    );
