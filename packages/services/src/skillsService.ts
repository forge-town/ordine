import type { SkillEntity } from "@repo/models";

type SkillsDao = {
  findMany: () => Promise<SkillEntity[]>;
  findById: (id: string) => Promise<SkillEntity | null>;
  findByName: (name: string) => Promise<SkillEntity | null>;
  create: (data: Omit<SkillEntity, "createdAt" | "updatedAt">) => Promise<SkillEntity>;
  update: (
    id: string,
    patch: Partial<Omit<SkillEntity, "createdAt" | "updatedAt">>,
  ) => Promise<SkillEntity | null>;
  delete: (id: string) => Promise<void>;
};

export const createSkillsService = (dao: SkillsDao) => ({
  getAll: () => dao.findMany(),
  getById: (id: string) => dao.findById(id),
  getByName: (name: string) => dao.findByName(name),
  create: (data: Omit<SkillEntity, "createdAt" | "updatedAt">) => dao.create(data),
  update: (id: string, patch: Partial<Omit<SkillEntity, "createdAt" | "updatedAt">>) =>
    dao.update(id, patch),
  delete: (id: string) => dao.delete(id),
});
