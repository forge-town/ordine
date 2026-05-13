import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { operationsService, operationRunnerService } from "../services";
import { AgentRuntimeSchema, ObjectNodeTypeSchema, OperationConfigSchema } from "@repo/schemas";

export const operationsRouter = router({
  getMany: publicProcedure.query(() => operationsService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => operationsService.getById(input.id)),

  create: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable().default(null),
        config: OperationConfigSchema.optional(),
        acceptedObjectTypes: z
          .array(ObjectNodeTypeSchema)
          .default(["file", "folder", "github-project"]),
      }),
    )
    .mutation(({ input }) => operationsService.create(input)),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        config: OperationConfigSchema.optional(),
        acceptedObjectTypes: z.array(ObjectNodeTypeSchema).optional(),
      }),
    )
    .mutation(({ input }) => {
      const { id, ...rest } = input;

      return operationsService.update(id, rest);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => operationsService.delete(input.id)),

  run: publicProcedure
    .input(
      z.object({
        operationId: z.string(),
        inputPath: z.string().optional(),
        inputContent: z.string().optional(),
        agentOverride: AgentRuntimeSchema.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await operationRunnerService.startRun(input);
      if (result.isErr()) {
        throw result.error;
      }

      return result.value;
    }),
});
