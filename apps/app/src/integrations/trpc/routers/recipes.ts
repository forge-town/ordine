import { publicProcedure, router } from "../init";
import { recipesService } from "../services";
import { RecipeSchema } from "@repo/schemas";
import { z } from "zod/v4";

export const recipesRouter = router({
  getMany: publicProcedure.query(() => recipesService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => recipesService.getById(input.id)),

  getByOperationId: publicProcedure
    .input(z.object({ operationId: z.string() }))
    .query(({ input }) => recipesService.getByOperationId(input.operationId)),

  create: publicProcedure.input(RecipeSchema).mutation(({ input }) => recipesService.create(input)),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: RecipeSchema.partial() }))
    .mutation(({ input }) => recipesService.update(input.id, input.patch)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => recipesService.delete(input.id)),
});
