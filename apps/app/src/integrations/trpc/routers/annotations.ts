import { randomUUID } from "node:crypto";
import { z } from "zod/v4";
import { CreateAnnotationSchema, UpdateAnnotationSchema } from "@repo/schemas";
import { publicProcedure, router } from "../init";
import { annotationsService } from "../services";
import { unwrapResult } from "./result";

const CreateAnnotationRouteSchema = CreateAnnotationSchema.extend({
  id: z.string().default(() => randomUUID()),
});

export const annotationsRouter = router({
  getMany: publicProcedure
    .input(
      z
        .object({
          pipelineId: z.string().optional(),
          targetId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const result = input?.pipelineId
        ? await annotationsService.getByPipelineId(input.pipelineId)
        : input?.targetId
          ? await annotationsService.getByTargetId(input.targetId)
          : await annotationsService.getAll();

      return unwrapResult(result);
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => unwrapResult(await annotationsService.getById(input.id))),

  create: publicProcedure
    .input(CreateAnnotationRouteSchema)
    .mutation(async ({ input }) => unwrapResult(await annotationsService.create(input))),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: UpdateAnnotationSchema }))
    .mutation(async ({ input }) =>
      unwrapResult(await annotationsService.update(input.id, input.patch)),
    ),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => unwrapResult(await annotationsService.delete(input.id))),
});
