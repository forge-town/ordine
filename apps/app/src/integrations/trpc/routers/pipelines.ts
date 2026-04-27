import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "../init";
import { pipelinesService, pipelineRunnerService } from "../services";
import { PipelineSchema } from "@repo/pipeline-engine/schemas";

export const pipelinesRouter = router({
  getMany: publicProcedure.query(() => pipelinesService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => pipelinesService.getById(input.id)),

  create: publicProcedure
    .input(PipelineSchema.omit({ createdAt: true, updatedAt: true }))
    .mutation(({ input }) =>
      pipelinesService.create({
        ...input,
        nodes: input.nodes as never,
        edges: input.edges as never,
      })
    ),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        patch: PipelineSchema.omit({ createdAt: true, updatedAt: true }).partial(),
      })
    )
    .mutation(({ input }) =>
      pipelinesService.update(input.id, {
        ...input.patch,
        nodes: input.patch.nodes as never,
        edges: input.patch.edges as never,
      })
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
      })
    )
    .mutation(async ({ input }) => {
      const pipeline = await pipelinesService.getById(input.id);
      if (!pipeline) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Pipeline not found" });
      }

      const result = await pipelineRunnerService.startRun({
        pipelineId: input.id,
        inputPath: input.inputPath,
        githubToken: input.githubToken,
      });

      if (result.isErr()) {
        throw new TRPCError({ code: "NOT_FOUND", message: result.error.message });
      }

      return result.value;
    }),

  optimizeFromDistillation: publicProcedure
    .input(
      z.object({
        distillationId: z.string(),
        userPrompt: z.string().default("Optimize this pipeline based on the distillation insights."),
      })
    )
    .mutation(async ({ input }) => {
      const result = await pipelinesService.optimizeFromDistillation({
        distillationId: input.distillationId,
        userPrompt: input.userPrompt,
      });

      if (!result) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate optimized pipeline",
        });
      }

      return result;
    }),
});
