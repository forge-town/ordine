import type { JobsDaoInstance } from "@repo/models";

export const createJobsService = (dao: JobsDaoInstance) => ({
  getAll: (...args: Parameters<typeof dao.findMany>) => dao.findMany(...args),
  getById: (id: string) => dao.findById(id),
  create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
  updateStatus: (...args: Parameters<typeof dao.updateStatus>) => dao.updateStatus(...args),
  delete: (id: string) => dao.delete(id),
});
