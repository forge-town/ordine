import { createRecipesDao, type DbConnection } from "@repo/models";
import { mapWithMeta, withMeta } from "@repo/schemas";

export const createRecipesService = (db: DbConnection) => {
  const dao = createRecipesDao(db);

  return {
    getAll: async () => mapWithMeta(await dao.findMany()),
    getById: async (id: string) => withMeta(await dao.findById(id)),
    getByOperationId: async (operationId: string) =>
      mapWithMeta(await dao.findByOperationId(operationId)),
    create: async (...args: Parameters<typeof dao.create>) => withMeta(await dao.create(...args)),
    update: async (...args: Parameters<typeof dao.update>) => withMeta(await dao.update(...args)),
    delete: (id: string) => dao.delete(id),
  };
};
