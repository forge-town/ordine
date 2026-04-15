import type { RecipeEntity } from "@repo/models";

type RecipesDao = {
  findMany: () => Promise<RecipeEntity[]>;
  findById: (id: string) => Promise<RecipeEntity | null>;
  findByOperationId: (operationId: string) => Promise<RecipeEntity[]>;
  create: (data: Omit<RecipeEntity, "createdAt" | "updatedAt">) => Promise<RecipeEntity>;
  update: (
    id: string,
    patch: Partial<Omit<RecipeEntity, "id" | "createdAt" | "updatedAt">>,
  ) => Promise<RecipeEntity | null>;
  delete: (id: string) => Promise<void>;
};

export const createRecipesService = (dao: RecipesDao) => ({
  getAll: () => dao.findMany(),
  getById: (id: string) => dao.findById(id),
  getByOperationId: (operationId: string) => dao.findByOperationId(operationId),
  create: (data: Omit<RecipeEntity, "createdAt" | "updatedAt">) => dao.create(data),
  update: (id: string, patch: Partial<Omit<RecipeEntity, "id" | "createdAt" | "updatedAt">>) =>
    dao.update(id, patch),
  delete: (id: string) => dao.delete(id),
});
