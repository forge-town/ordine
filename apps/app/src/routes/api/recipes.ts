import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod/v4";
import { recipesDao } from "@repo/models";
import { json, errorResponse, parseJsonBody } from "@/lib/apiResponse";

const CreateRecipeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  operationId: z.string(),
  bestPracticeId: z.string(),
});

export const Route = createFileRoute("/api/recipes")({
  server: {
    handlers: {
      GET: async () => {
        const recipes = await recipesDao.findMany();
        return json(recipes);
      },

      POST: async ({ request }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = CreateRecipeSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const recipe = await recipesDao.create(parsed.data);
        return json(recipe, 201);
      },

      PUT: async ({ request }) => {
        const bodyResult = await parseJsonBody(request);
        if (bodyResult.isErr()) return bodyResult.error;

        const parsed = CreateRecipeSchema.safeParse(bodyResult.value);
        if (!parsed.success) {
          return errorResponse(parsed.error.message, 400);
        }

        const existing = await recipesDao.findById(parsed.data.id);
        if (existing) {
          const { id: _, ...patch } = parsed.data;
          const updated = await recipesDao.update(parsed.data.id, patch);
          return json(updated);
        }
        const recipe = await recipesDao.create(parsed.data);
        return json(recipe, 201);
      },
    },
  },
});
