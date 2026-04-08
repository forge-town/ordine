import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { githubProjectsDao } from "@/models/daos/githubProjectsDao";
import { GithubProjectSchema } from "@/schemas";

export const githubProjectsRouter = router({
  getMany: publicProcedure.query(() => githubProjectsDao.findMany()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => githubProjectsDao.findById(input.id)),

  create: publicProcedure
    .input(GithubProjectSchema)
    .mutation(({ input }) => githubProjectsDao.create(input)),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: GithubProjectSchema.partial() }))
    .mutation(({ input }) => githubProjectsDao.update(input.id, input.patch)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => githubProjectsDao.delete(input.id)),
});
