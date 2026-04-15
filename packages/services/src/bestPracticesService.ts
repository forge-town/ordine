import type { BestPracticeEntity } from "@repo/models";

type BestPracticesDao = {
  findMany: () => Promise<BestPracticeEntity[]>;
  findById: (id: string) => Promise<BestPracticeEntity | null>;
  create: (
    data: Omit<BestPracticeEntity, "createdAt" | "updatedAt">,
  ) => Promise<BestPracticeEntity>;
  update: (
    id: string,
    patch: Partial<Omit<BestPracticeEntity, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<BestPracticeEntity | null>;
  delete: (id: string) => Promise<void>;
};

export const createBestPracticesService = (dao: BestPracticesDao) => ({
  getAll: () => dao.findMany(),
  getById: (id: string) => dao.findById(id),
  create: (data: Omit<BestPracticeEntity, "createdAt" | "updatedAt">) => dao.create(data),
  update: (
    id: string,
    patch: Partial<Omit<BestPracticeEntity, "id" | "createdAt" | "updatedAt">>,
  ) => dao.update(id, patch),
  delete: (id: string) => dao.delete(id),
});
