import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { CreatePipelineAssetSchema, UpdatePipelineAssetSchema } from "@repo/schemas";
import { publicProcedure, router } from "../init";
import { pipelineAssetsService } from "../services";
import { unwrapResult } from "./result";

const runStatsSchema = z.object({
  success: z.boolean(),
  durationMs: z.number().int().nonnegative(),
});

const CreatePipelineAssetRouteSchema = CreatePipelineAssetSchema.extend({
  id: z.string().default(() => randomUUID()),
});

export const pipelineAssetsRouter = router({
  getMany: publicProcedure
    .input(z.object({ pipelineId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const result = input?.pipelineId
        ? await pipelineAssetsService.getByPipelineId(input.pipelineId)
        : await pipelineAssetsService.getAll();

      return unwrapResult(result);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => unwrapResult(await pipelineAssetsService.getById(input.id))),

  getUsageCount: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => unwrapResult(await pipelineAssetsService.getUsageCount(input.id))),

  create: publicProcedure
    .input(CreatePipelineAssetRouteSchema)
    .mutation(async ({ input }) => unwrapResult(await pipelineAssetsService.create(input))),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: UpdatePipelineAssetSchema }))
    .mutation(async ({ input }) =>
      unwrapResult(await pipelineAssetsService.update(input.id, input.patch)),
    ),

  incrementRunStats: publicProcedure
    .input(z.object({ id: z.string(), stats: runStatsSchema }))
    .mutation(async ({ input }) =>
      unwrapResult(await pipelineAssetsService.incrementRunStats(input.id, input.stats)),
    ),

  distillFromPipeline: publicProcedure
    .input(z.object({ pipelineId: z.string() }))
    .mutation(async ({ input }) =>
      unwrapResult(await pipelineAssetsService.distillFromPipeline(input.pipelineId)),
    ),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => unwrapResult(await pipelineAssetsService.delete(input.id))),
});
