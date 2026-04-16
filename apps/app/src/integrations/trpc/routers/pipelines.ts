import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../init";
import { pipelinesService, pipelineRunnerService } from "../services";
import { PipelineSchema } from "@repo/schemas";

export const pipelinesRouter = router({
  getMany: publicProcedure.query(() => pipelinesService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => pipelinesService.getById(input.id)),

  create: publicProcedure
    .input(PipelineSchema.omit({ createdAt: true, updatedAt: true, nodeCount: true }))
    .mutation(({ input }) =>
      pipelinesService.create({
        ...input,
        nodes: input.nodes as never,
        edges: input.edges as never,
      }),
    ),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        patch: PipelineSchema.omit({ createdAt: true, updatedAt: true, nodeCount: true }).partial(),
      }),
    )
    .mutation(({ input }) =>
      pipelinesService.update(input.id, {
        ...input.patch,
        nodes: input.patch.nodes as never,
        edges: input.patch.edges as never,
      }),
    ),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => pipelinesService.delete(input.id)),

  run: publicProcedure
    .input(
      z.object({
        id: z.string(),
        inputPath: z.string().optional(),
        githubToken: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const pipeline = await pipelinesService.getById(input.id);
      if (!pipeline) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline not found" });
      }

      return pipelineRunnerService.startRun({
        pipelineId: input.id,
        inputPath: input.inputPath,
        githubToken: input.githubToken,
      });
    }),
});
