import { publicProcedure, router } from "../init";
import { bestPracticesService, bestPracticesBulkService } from "../services";
import { BestPracticeSchema, ChecklistItemSchema, CodeSnippetSchema } from "@repo/schemas";
import { z } from "zod/v4";

export const bestPracticesRouter = router({
  getMany: publicProcedure.query(() => bestPracticesService.getAll()),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => bestPracticesService.getById(input.id)),

  create: publicProcedure
    .input(BestPracticeSchema)
    .mutation(({ input }) => bestPracticesService.create(input)),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: BestPracticeSchema.partial() }))
    .mutation(({ input }) => bestPracticesService.update(input.id, input.patch)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => bestPracticesService.delete(input.id)),

  exportAll: publicProcedure.query(() => bestPracticesBulkService.exportAll()),

  importBulk: publicProcedure
    .input(
      z.array(
        BestPracticeSchema.extend({
          checklistItems: z.array(ChecklistItemSchema.omit({ bestPracticeId: true })).default([]),
          codeSnippets: z.array(CodeSnippetSchema.omit({ bestPracticeId: true })).default([]),
        }),
      ),
    )
    .mutation(({ input }) => bestPracticesBulkService.importBulk(input)),
});
