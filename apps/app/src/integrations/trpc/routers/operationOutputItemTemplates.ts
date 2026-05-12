import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { operationOutputItemTemplatesService } from "../services";
import { TemplateContentTypeSchema } from "@repo/schemas";

export const operationOutputItemTemplatesRouter = router({
  getMany: publicProcedure.query(() => operationOutputItemTemplatesService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => operationOutputItemTemplatesService.getById(input.id)),

  create: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().nullable().default(null),
        content: z.string(),
        contentType: TemplateContentTypeSchema,
      }),
    )
    .mutation(({ input }) => operationOutputItemTemplatesService.create(input)),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        content: z.string().optional(),
        contentType: TemplateContentTypeSchema.optional(),
      }),
    )
    .mutation(({ input }) => {
      const { id, ...rest } = input;

      return operationOutputItemTemplatesService.update(id, rest);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => operationOutputItemTemplatesService.delete(input.id)),
});
