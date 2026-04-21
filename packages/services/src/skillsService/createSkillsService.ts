import { createSkillsDao, type DbConnection } from "@repo/models";

export const createSkillsService = (db: DbConnection) => {
  const dao = createSkillsDao(db);

  return {
    getAll: () => dao.findMany(),
    getById: (id: string) => dao.findById(id),
    getByName: (name: string) => dao.findByName(name),
    create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
    update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
    delete: (id: string) => dao.delete(id),
    seedIfEmpty: () => dao.seedIfEmpty(),
  };
};
