import { publicProcedure, router } from "../init";
import { bestPracticesDao } from "@/models/daos/bestPracticesDao";
import { BestPracticeSchema } from "@/schemas";
import { z } from "zod/v4";

export const bestPracticesRouter = router({
  getMany: publicProcedure.query(() => bestPracticesDao.findMany()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => bestPracticesDao.findById(input.id)),

  create: publicProcedure
    .input(BestPracticeSchema)
    .mutation(({ input }) => bestPracticesDao.create(input)),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: BestPracticeSchema.partial() }))
    .mutation(({ input }) => bestPracticesDao.update(input.id, input.patch)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => bestPracticesDao.delete(input.id)),
});
