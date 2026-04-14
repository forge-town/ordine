import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { skillsDao } from "@repo/models";
import { SkillSchema } from "@/schemas";

export const skillsRouter = router({
  getMany: publicProcedure.query(async () => {
    await skillsDao.seedIfEmpty();
    return skillsDao.findMany();
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => skillsDao.findById(input.id)),

  create: publicProcedure.input(SkillSchema).mutation(({ input }) => skillsDao.create(input)),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: SkillSchema.partial() }))
    .mutation(({ input }) => skillsDao.update(input.id, input.patch)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => skillsDao.delete(input.id)),
});
