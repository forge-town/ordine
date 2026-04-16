import type { BestPracticesDaoInstance } from "@repo/models";

export const createBestPracticesService = (dao: BestPracticesDaoInstance) => ({
  getAll: () => dao.findMany(),
  getById: (id: string) => dao.findById(id),
  create: (data: Parameters<typeof dao.create>[0]) => dao.create(data),
  update: (id: string, patch: Parameters<typeof dao.update>[1]) => dao.update(id, patch),
  delete: (id: string) => dao.delete(id),
});
