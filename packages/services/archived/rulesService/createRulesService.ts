import { createRulesDao, type DbConnection } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createRulesService = (db: DbConnection) => {
  const dao = createRulesDao(db);

  return {
    getAll: async (...args: Parameters<typeof dao.findMany>) => {
      const records = await dao.findMany(...args);

      return records.map(withMeta);
    },
    getById: async (id: string) => withMeta(await dao.findById(id)),
    create: async (...args: Parameters<typeof dao.create>) => withMeta(await dao.create(...args)),
    update: async (...args: Parameters<typeof dao.update>) => withMeta(await dao.update(...args)),
    toggleEnabled: async (id: string, enabled: boolean) =>
      withMeta(await dao.toggleEnabled(id, enabled)),
    delete: (id: string) => dao.delete(id),
  };
};
