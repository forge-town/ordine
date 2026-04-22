import { createOperationsDao, type DbConnection } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createOperationsService = (db: DbConnection) => {
  const dao = createOperationsDao(db);

  return {
    getAll: async () => {
      const records = await dao.findMany();

      return records.map(withMeta);
    },
    getById: async (id: string) => withMeta(await dao.findById(id)),
    create: async (...args: Parameters<typeof dao.create>) => withMeta(await dao.create(...args)),
    update: async (...args: Parameters<typeof dao.update>) => withMeta(await dao.update(...args)),
    delete: (id: string) => dao.delete(id),
  };
};
