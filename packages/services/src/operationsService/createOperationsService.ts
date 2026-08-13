import { createOperationsDao, type DbConnection } from "@repo/models";
import { mapWithMeta, withMeta } from "@repo/schemas";
import { okAsync, ResultAsync } from "neverthrow";
import {
  createCapabilityCatalogService,
  type CapabilityCatalogServiceOptions,
} from "../capabilityCatalogService";
import { toServiceError } from "../serviceErrors";

export interface OperationsServiceOptions {
  capabilityCatalog?: ReturnType<typeof createCapabilityCatalogService>;
  capabilityCatalogOptions?: CapabilityCatalogServiceOptions;
}

export const createOperationsService = (
  db: DbConnection,
  options: OperationsServiceOptions = {},
) => {
  const dao = createOperationsDao(db);
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

  return {
    getAll: async () => mapWithMeta(await dao.findMany()),
    getById: async (id: string) => withMeta(await dao.findById(id)),
    create,
    update,
    delete: (id: string) => dao.delete(id),
  };
};
