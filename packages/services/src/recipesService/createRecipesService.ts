import { createRecipesDao, type DbConnection } from "@repo/models";

export const createRecipesService = (db: DbConnection) => {
  const dao = createRecipesDao(db);

  return {
    getAll: () => dao.findMany(),
    getById: (id: string) => dao.findById(id),
    getByOperationId: (operationId: string) => dao.findByOperationId(operationId),
    create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
    update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
    delete: (id: string) => dao.delete(id),
  };
};
