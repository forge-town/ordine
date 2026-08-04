import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
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
      const routines = input?.pipelineId
        ? await routinesService.getByPipelineId(input.pipelineId)
        : input?.enabled === true
          ? await routinesService.getEnabled()
          : await routinesService.getAll();

      return input?.enabled === undefined
        ? routines
        : routines.filter((routine) => routine.enabled === input.enabled);
    }),

  getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ input }) => {
    const routine = await routinesService.getById(input.id);
    if (!routine) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Routine not found" });
    }

    return routine;
  }),

  create: publicProcedure
    .input(CreateRoutineRouteSchema)
    .mutation(async ({ input }) => unwrapResult(await routinesService.create(input))),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: UpdateRoutineSchema }))
    .mutation(async ({ input }) =>
      unwrapResult(await routinesService.update(input.id, input.patch)),
    ),

  runNow: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => unwrapResult(await routinesService.runNow(input.id))),

  delete: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ input }) => {
    await routinesService.delete(input.id);

    return { deleted: true };
  }),
});
