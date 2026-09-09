import { legacyExecutionDisabled } from "./legacyExecutionDisabled";
import { z } from "zod/v4";
import { TRPCError } from "@trpc/server";
import { authedProcedure, publicProcedure, router } from "../init";
import { pipelinesService, canvasExecutionPublisher } from "../services";
import { getServerEnv } from "@/integrations/server-env";
import { getProposeProgress, setProposeProgress } from "@repo/services";
import { unwrapResult } from "./result";
import {
  AgentContextPayloadSchema,
  PipelineGraphSnapshotSchema,
  PipelineSchema,
  ProposeAttachmentSchema,
  ProposePendingOperationSchema,
  ExecutionOverridesSchema,
} from "@repo/schemas";

export const pipelinesRouter = router({
  publishExecution: authedProcedure
    .input(
      z.strictObject({
        pipelineId: z.string().min(1),
        executionOverrides: ExecutionOverridesSchema.optional(),
        expectedRevision: z.number().int().nonnegative().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const owner = getServerEnv().ORDINE_EXECUTION_OWNER_USER_ID;
      const session = z.object({ user: z.object({ id: z.string() }) }).safeParse(ctx.session);
      if (!owner || !session.success || session.data.user.id !== owner)
        throw new TRPCError({ code: "FORBIDDEN", message: "此会话未绑定当前执行工作区。" });

      return unwrapResult(await canvasExecutionPublisher.publish(input));
    }),
  getMany: publicProcedure.query(() => pipelinesService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => (await pipelinesService.getById(input.id)) ?? null),

  create: publicProcedure
    .input(
      z.object({
        pipeline: PipelineSchema.omit({ createdAt: true, updatedAt: true }),
        pendingOperations: z.array(ProposePendingOperationSchema).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const pipeline = {
        ...input.pipeline,
        nodes: input.pipeline.nodes as never,
        edges: input.pipeline.edges as never,
      };
      if (input.pendingOperations && input.pendingOperations.length > 0) {
        return unwrapResult(
          await pipelinesService.createWithPendingOperations(
            pipeline,
            input.pendingOperations as Parameters<
              typeof pipelinesService.createWithPendingOperations
            >[1],
          ),
        );
      }

      return unwrapResult(await pipelinesService.create(pipeline));
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        patch: PipelineSchema.omit({ createdAt: true, updatedAt: true }).partial().extend({
          description: z.string().optional(),
          sharedContext: z.string().optional(),
          edges: PipelineGraphSnapshotSchema.shape.edges.optional(),
          nodes: PipelineGraphSnapshotSchema.shape.nodes.optional(),
        }),
      }),
    )
    .mutation(async ({ input }) =>
      unwrapResult(
        await pipelinesService.update(input.id, {
          ...input.patch,
          nodes: input.patch.nodes as never,
          edges: input.patch.edges as never,
        }),
      ),
    ),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => pipelinesService.delete(input.id)),

  run: publicProcedure.input(z.unknown().optional()).mutation(legacyExecutionDisabled),

  cancel: authedProcedure.input(z.unknown().optional()).mutation(legacyExecutionDisabled),

  optimizeFromDistillation: publicProcedure
    .input(
      z.object({
        distillationId: z.string(),
        userPrompt: z
          .string()
          .default("Optimize this pipeline based on the distillation insights."),
      }),
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

  createPendingOperations: publicProcedure
    .input(z.object({ operations: z.array(ProposePendingOperationSchema) }))
    .mutation(async ({ input }) => {
      unwrapResult(
        await pipelinesService.createPendingOperations(
          input.operations as Parameters<typeof pipelinesService.createPendingOperations>[0],
        ),
      );

      return { created: input.operations.length };
    }),

  proposeActions: publicProcedure
    .input(
      z.object({
        id: z.string(),
        attachments: z.array(ProposeAttachmentSchema).optional(),
        context: AgentContextPayloadSchema.optional(),
        diagnostics: z.array(z.string()).optional(),
        failedProposal: z.unknown().optional(),
        snapshot: PipelineGraphSnapshotSchema,
        message: z.string().trim().min(1),
        pipelineName: z.string().optional(),
        progressToken: z.string().optional(),
        referencedNodeIds: z.array(z.string()).optional(),
        runtimeId: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await pipelinesService.proposeActions({
        pipelineId: input.id,
        attachments: input.attachments,
        context: input.context,
        diagnostics: input.diagnostics,
        failedProposal: input.failedProposal,
        snapshot: input.snapshot,
        message: input.message,
        pipelineName: input.pipelineName,
        progressToken: input.progressToken,
        referencedNodeIds: input.referencedNodeIds,
        runtimeId: input.runtimeId,
      });
      if (input.progressToken) {
        setProposeProgress(input.progressToken, "done");
      }

      return result;
    }),

  proposeProgress: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(({ input }) => ({ stage: getProposeProgress(input.token) })),

  generateStructure: publicProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string(),
        matchedOperations: z
          .array(
            z.object({
              operationId: z.string(),
              operationName: z.string(),
              reason: z.string(),
            }),
          )
          .optional(),
        unmatchedSteps: z
          .array(
            z.object({
              step: z.string(),
              reason: z.string(),
            }),
          )
          .optional(),
        runtimeId: z.string().min(1).optional(),
        model: z.string().min(1).optional(),
      }),
    )
    .mutation(({ input }) => pipelinesService.generateStructure(input)),

  analyzeIntent: publicProcedure
    .input(z.object({ name: z.string(), description: z.string() }))
    .mutation(({ input }) => pipelinesService.analyzeIntent(input)),
});
