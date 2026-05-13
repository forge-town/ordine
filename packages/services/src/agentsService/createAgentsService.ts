import { createAgentsDao, type DbConnection } from "@repo/models";
import { mapWithMeta, withMeta } from "@repo/schemas";

export const createAgentsService = (db: DbConnection) => {
  const dao = createAgentsDao(db);

  return {
    getAll: async () => mapWithMeta(await dao.findMany()),
    getById: async (id: string) => withMeta(await dao.findById(id)),
    create: async (...args: Parameters<typeof dao.create>) => withMeta(await dao.create(...args)),
    update: async (...args: Parameters<typeof dao.update>) => withMeta(await dao.update(...args)),
    delete: (id: string) => dao.delete(id),
  };
};
