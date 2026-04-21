import { createGithubProjectsDao, type DbConnection } from "@repo/models";

export const createGithubProjectsService = (db: DbConnection) => {
  const dao = createGithubProjectsDao(db);

  return {
    getAll: () => dao.findMany(),
    getById: (id: string) => dao.findById(id),
    create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
    update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
    delete: (id: string) => dao.delete(id),
  };
};
