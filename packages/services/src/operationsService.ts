import type { OperationsDaoInstance } from "@repo/models";

export const createOperationsService = (dao: OperationsDaoInstance) => ({
  getAll: () => dao.findMany(),
  getById: (id: string) => dao.findById(id),
  create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
  update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
  delete: (id: string) => dao.delete(id),
});
