import { createBestPracticesDao, type DbConnection } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createBestPracticesService = (db: DbConnection) => {
  const dao = createBestPracticesDao(db);

  return {
    getAll: async () => {
      const records = await dao.findMany();

      return records.map(withMeta);
    },
    getById: async (id: string) => withMeta(await dao.findById(id)),
    create: async (data: Parameters<typeof dao.create>[0]) => withMeta(await dao.create(data)),
    update: async (id: string, patch: Parameters<typeof dao.update>[1]) =>
      withMeta(await dao.update(id, patch)),
    delete: (id: string) => dao.delete(id),
  };
};
