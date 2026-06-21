import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { CreateRoutineSchema, UpdateRoutineSchema } from "@repo/schemas";
import { publicProcedure, router } from "../init";
import { routinesService } from "../services";
import { unwrapResult } from "./result";

const CreateRoutineRouteSchema = CreateRoutineSchema.extend({
  id: z.string().default(() => randomUUID()),
});

export const routinesRouter = router({
  getMany: publicProcedure
    .input(
      z
        .object({
          pipelineId: z.string().optional(),
          enabled: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const result = input?.pipelineId
        ? await routinesService.getByPipelineId(input.pipelineId)
        : input?.enabled
          ? await routinesService.getEnabled()
          : await routinesService.getAll();

      return unwrapResult(result);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => unwrapResult(await routinesService.getById(input.id))),

  create: publicProcedure
    .input(CreateRoutineRouteSchema)
    .mutation(async ({ input }) => unwrapResult(await routinesService.create(input))),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: UpdateRoutineSchema }))
    .mutation(async ({ input }) =>
      unwrapResult(await routinesService.update(input.id, input.patch)),
    ),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => unwrapResult(await routinesService.delete(input.id))),
});
