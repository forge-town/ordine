import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { recipesDao } from "@repo/models";
import { RecipeSchema } from "@repo/schemas";

export const getRecipes = createServerFn({ method: "GET" }).handler(() => recipesDao.findMany());

export const getRecipeById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => recipesDao.findById(data.id));

export const getRecipesByOperationId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ operationId: z.string() }))
  .handler(({ data }) => recipesDao.findByOperationId(data.operationId));

export const createRecipe = createServerFn({ method: "POST" })
  .inputValidator(RecipeSchema)
  .handler(({ data }) => recipesDao.create(data));

export const updateRecipe = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), patch: RecipeSchema.partial() }))
  .handler(({ data }) => recipesDao.update(data.id, data.patch));

export const deleteRecipe = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => recipesDao.delete(data.id));
