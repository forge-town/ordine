import type { RecipesDaoInstance } from "@repo/models";

export const createRecipesService = (dao: RecipesDaoInstance) => ({
  getAll: () => dao.findMany(),
  getById: (id: string) => dao.findById(id),
  getByOperationId: (operationId: string) => dao.findByOperationId(operationId),
  create: (...args: Parameters<typeof dao.create>) => dao.create(...args),
  update: (...args: Parameters<typeof dao.update>) => dao.update(...args),
  delete: (id: string) => dao.delete(id),
});
