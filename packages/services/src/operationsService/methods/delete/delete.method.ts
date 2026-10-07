import type { createOperationRegistryRepository } from "@repo/models";

import { ResultAsync } from "neverthrow";

import { toServiceError } from "../../../serviceErrors";
import { OperationInUseConflictError } from "../../contracts";
export const createDeleteMethod =
  (operationRegistryRepository: ReturnType<typeof createOperationRegistryRepository>) =>
  (id: string) =>
    ResultAsync.fromPromise(
      operationRegistryRepository.runSerializable(async ({ operationsDao, pipelinesDao }) => {
        const pipelines = await pipelinesDao.findMany();
        const pipelineIds = pipelines.flatMap((pipeline) =>
          pipeline.nodes.some(
            (node) => node.data.nodeType === "operation" && node.data.operationId === id,
          )
            ? [pipeline.id]
            : [],
        );
        if (pipelineIds.length > 0) {
          throw new OperationInUseConflictError(id, pipelineIds);
        }

        await operationsDao.delete(id);
      }),
      (error) =>
        error instanceof OperationInUseConflictError
          ? error
          : toServiceError(error, `Delete Operation ${id}`),
    );
