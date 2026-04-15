import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { worksService } from "../services";
import { WorkObjectSchema } from "@repo/schemas";

export const worksRouter = router({
  getMany: publicProcedure.query(() => worksService.getAll()),

  getByProject: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(({ input }) => worksService.getByProject(input.projectId)),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => worksService.getById(input.id)),

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
    .mutation(({ input }) => worksService.create({ ...input, status: "pending", logs: [] })),

  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["pending", "running", "success", "failed"]),
      })
    )
    .mutation(({ input }) => worksService.updateStatus(input.id, input.status)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => worksService.delete(input.id)),
});
