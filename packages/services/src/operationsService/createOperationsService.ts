import { createOperationsDao, createPipelinesDao, type DbConnection } from "@repo/models";
import { mapWithMeta, withMeta } from "@repo/schemas";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import {
  createCapabilityCatalogService,
  type CapabilityCatalogServiceOptions,
} from "../capabilityCatalogService";
import { ConflictError, toServiceError } from "../serviceErrors";

export class OperationInUseConflictError extends ConflictError {
  readonly code = "OPERATION_IN_USE";

  constructor(
    readonly operationId: string,
    readonly pipelineIds: string[],
  ) {
    super(`Operation ${operationId} is referenced by Pipeline ${pipelineIds.join(", ")}`);
    this.name = "OperationInUseConflictError";
  }
}

export interface OperationsServiceOptions {
  capabilityCatalog?: ReturnType<typeof createCapabilityCatalogService>;
  capabilityCatalogOptions?: CapabilityCatalogServiceOptions;
}

export const createOperationsService = (
  db: DbConnection,
  options: OperationsServiceOptions = {},
) => {
  const dao = createOperationsDao(db);
  const pipelinesDao = createPipelinesDao(db);
  const capabilityCatalog =
    options.capabilityCatalog ??
    createCapabilityCatalogService(db, options.capabilityCatalogOptions);

  const create = (data: Parameters<typeof dao.create>[0]) =>
    capabilityCatalog
      .validateOperationInput({
        config: data.config === undefined ? {} : data.config,
        sourceSkillId: data.sourceSkillId,
      })
      .andThen(() =>
        ResultAsync.fromPromise(dao.create(data), (error) =>
          toServiceError(error, "Create operation"),
        ),
      )
      .map(withMeta);

  const update = (id: string, patch: Parameters<typeof dao.update>[1]) => {
    const validation =
      !Object.hasOwn(patch, "config") && !Object.hasOwn(patch, "sourceSkillId")
        ? okAsync(undefined)
        : capabilityCatalog.validateOperationPatch({
            ...(Object.hasOwn(patch, "config") ? { config: patch.config } : {}),
            ...(Object.hasOwn(patch, "sourceSkillId")
              ? { sourceSkillId: patch.sourceSkillId }
              : {}),
          });

    return validation
      .andThen(() =>
        ResultAsync.fromPromise(dao.update(id, patch), (error) =>
          toServiceError(error, "Update operation"),
        ),
      )
      .map(withMeta);
  };

  const deleteOperation = (id: string) =>
    ResultAsync.fromPromise(pipelinesDao.findMany(), (error) =>
      toServiceError(error, `Check Operation ${id} Pipeline references`),
    ).andThen((pipelines) => {
      const pipelineIds = pipelines.flatMap((pipeline) =>
        pipeline.nodes.some(
          (node) => node.data.nodeType === "operation" && node.data.operationId === id,
        )
          ? [pipeline.id]
          : [],
      );
      if (pipelineIds.length > 0) {
        return errAsync(new OperationInUseConflictError(id, pipelineIds));
      }

      return ResultAsync.fromPromise(dao.delete(id), (error) =>
        toServiceError(error, `Delete Operation ${id}`),
      );
    });

  return {
    getAll: async () => mapWithMeta(await dao.findMany()),
    getById: async (id: string) => withMeta(await dao.findById(id)),
    create,
    update,
    delete: deleteOperation,
  };
};
