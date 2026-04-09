import { publicProcedure, router } from "../init";
import { recipesDao } from "@/models/daos/recipesDao";
import { RecipeSchema } from "@/schemas";
import { z } from "zod/v4";

export const recipesRouter = router({
  getMany: publicProcedure.query(() => recipesDao.findMany()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => recipesDao.findById(input.id)),

  getByOperationId: publicProcedure
    .input(z.object({ operationId: z.string() }))
    .query(({ input }) => recipesDao.findByOperationId(input.operationId)),

  create: publicProcedure
    .input(RecipeSchema)
    .mutation(({ input }) => recipesDao.create(input)),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: RecipeSchema.partial() }))
    .mutation(({ input }) => recipesDao.update(input.id, input.patch)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => recipesDao.delete(input.id)),
});
