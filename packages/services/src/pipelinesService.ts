import type { PipelinesDaoInstance } from "@repo/models";

export const createPipelinesService = (dao: PipelinesDaoInstance) => ({
  getAll: () => dao.findMany(),
  getById: (id: string) => dao.findById(id),
  create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
  update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
  delete: (id: string) => dao.delete(id),
});
