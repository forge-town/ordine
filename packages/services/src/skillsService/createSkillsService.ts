import { createSkillsDao, type DbConnection } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createSkillsService = (db: DbConnection) => {
  const dao = createSkillsDao(db);

  return {
    getAll: async () => (await dao.findMany()).map(withMeta),
    getById: async (id: string) => withMeta(await dao.findById(id)),
    getByName: async (name: string) => withMeta(await dao.findByName(name)),
    create: async (...args: Parameters<typeof dao.create>) => withMeta(await dao.create(...args)),
    update: async (...args: Parameters<typeof dao.update>) => withMeta(await dao.update(...args)),
    delete: (id: string) => dao.delete(id),
    seedIfEmpty: () => dao.seedIfEmpty(),
  };
};
