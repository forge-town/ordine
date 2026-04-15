import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { worksDao } from "@repo/models";
import { WorkObjectSchema } from "@repo/schemas";

export const worksRouter = router({
  getMany: publicProcedure.query(() => worksDao.findMany()),

  getByProject: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => worksDao.findByProject(input.projectId)),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => worksDao.findById(input.id)),

  create: publicProcedure
    .input(
      z.object({
        id: z.string(),
        projectId: z.string(),
        pipelineId: z.string(),
        pipelineName: z.string(),
        object: WorkObjectSchema,
      })
    )
    .mutation(({ input }) => worksDao.create({ ...input, status: "pending", logs: [] })),

  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["pending", "running", "success", "failed"]),
      })
    )
    .mutation(({ input }) => worksDao.updateStatus(input.id, input.status)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => worksDao.delete(input.id)),
});
