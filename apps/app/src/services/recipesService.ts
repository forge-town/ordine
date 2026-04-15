import { createServerFn } from "@tanstack/react-start";
import { z } from "zod/v4";
import { recipesDao } from "@repo/models";
import { RecipeSchema } from "@repo/schemas";
import { createRecipesService } from "@repo/services";

const service = createRecipesService(recipesDao);

export const getRecipes = createServerFn({ method: "GET" }).handler(() => service.getAll());

export const getRecipeById = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.getById(data.id));

export const getRecipesByOperationId = createServerFn({ method: "GET" })
  .inputValidator(z.object({ operationId: z.string() }))
  .handler(({ data }) => service.getByOperationId(data.operationId));

export const createRecipe = createServerFn({ method: "POST" })
  .inputValidator(RecipeSchema)
  .handler(({ data }) => service.create(data));

export const updateRecipe = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string(), patch: RecipeSchema.partial() }))
  .handler(({ data }) => service.update(data.id, data.patch));

export const deleteRecipe = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.string() }))
  .handler(({ data }) => service.delete(data.id));
