import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { operationsService, operationRunnerService } from "../services";
import {
  AgentRuntimeSchema,
  ObjectNodeTypeSchema,
  StrictOperationConfigSchema,
} from "@repo/schemas";
import { unwrapResult } from "./result";

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
        config: StrictOperationConfigSchema.optional(),
        acceptedObjectTypes: z
          .array(ObjectNodeTypeSchema)
          .default(["file", "folder", "github-project"]),
        sourceSkillId: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => unwrapResult(await operationsService.create(input))),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        config: StrictOperationConfigSchema.optional(),
        acceptedObjectTypes: z.array(ObjectNodeTypeSchema).optional(),
        sourceSkillId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { id, ...rest } = input;

      return unwrapResult(await operationsService.update(id, rest));
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
