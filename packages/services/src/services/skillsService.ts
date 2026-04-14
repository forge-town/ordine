import type { createSkillsDao, SkillEntity } from "../daos/skillsDao.js";

type SkillsDao = ReturnType<typeof createSkillsDao>;

export const createSkillsService = (dao: SkillsDao) => ({
  getAll: () => dao.findMany(),
  getById: (id: string) => dao.findById(id),
  getByName: (name: string) => dao.findByName(name),
  create: (data: Omit<SkillEntity, "createdAt" | "updatedAt">) => dao.create(data),
  update: (id: string, patch: Partial<Omit<SkillEntity, "createdAt" | "updatedAt">>) =>
    dao.update(id, patch),
  delete: (id: string) => dao.delete(id),
});
