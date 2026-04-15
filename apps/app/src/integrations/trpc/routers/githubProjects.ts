import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { githubProjectsService } from "../services";
import { GithubProjectSchema } from "@repo/schemas";

export const githubProjectsRouter = router({
  getMany: publicProcedure.query(() => githubProjectsService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => githubProjectsService.getById(input.id)),

  create: publicProcedure
    .input(GithubProjectSchema)
    .mutation(({ input }) => githubProjectsService.create(input)),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: GithubProjectSchema.partial() }))
    .mutation(({ input }) => githubProjectsService.update(input.id, input.patch)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => githubProjectsService.delete(input.id)),
});
