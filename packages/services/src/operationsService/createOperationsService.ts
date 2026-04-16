import { createOperationsDao, type DbConnection } from "@repo/models";

export const createOperationsService = (db: DbConnection) => {
  const dao = createOperationsDao(db);

  return {
    getAll: () => dao.findMany(),
    getById: (id: string) => dao.findById(id),
    create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
    update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
    delete: (id: string) => dao.delete(id),
  };
};
