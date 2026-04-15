import type { SkillsDaoInstance } from "@repo/models";

export const createSkillsService = (dao: SkillsDaoInstance) => ({
  getAll: () => dao.findMany(),
  getById: (id: string) => dao.findById(id),
  getByName: (name: string) => dao.findByName(name),
  create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
  update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
  delete: (id: string) => dao.delete(id),
});
