import { z } from "zod/v4";
import { publicProcedure, router } from "../init";
import { codeSnippetsService } from "../services";
import { CodeSnippetSchema } from "@repo/schemas";

export const codeSnippetsRouter = router({
  getByBestPracticeId: publicProcedure
    .input(z.object({ bestPracticeId: z.string() }))
    .query(({ input }) => codeSnippetsService.getByBestPracticeId(input.bestPracticeId)),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => codeSnippetsService.getById(input.id)),

  create: publicProcedure
    .input(CodeSnippetSchema)
    .mutation(({ input }) => codeSnippetsService.create(input)),

  update: publicProcedure
    .input(z.object({ id: z.string(), patch: CodeSnippetSchema.partial() }))
    .mutation(({ input }) => codeSnippetsService.update(input.id, input.patch)),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => codeSnippetsService.delete(input.id)),
});
