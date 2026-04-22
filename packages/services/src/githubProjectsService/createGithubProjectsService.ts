import { createGithubProjectsDao, type DbConnection } from "@repo/models";
import { withMeta } from "@repo/schemas";

export const createGithubProjectsService = (db: DbConnection) => {
  const dao = createGithubProjectsDao(db);

  return {
    getAll: async () => (await dao.findMany()).map(withMeta),
    getById: async (id: string) => withMeta(await dao.findById(id)),
    create: async (...args: Parameters<typeof dao.create>) => withMeta(await dao.create(...args)),
    update: async (...args: Parameters<typeof dao.update>) => withMeta(await dao.update(...args)),
    delete: (id: string) => dao.delete(id),
  };
};
