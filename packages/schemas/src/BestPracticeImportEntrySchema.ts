import { z } from "zod/v4";
import { BestPracticeSchema } from "./BestPracticeSchema";
import { ChecklistItemSchema } from "./ChecklistItemSchema";
import { CodeSnippetSchema } from "./CodeSnippetSchema";

export const BestPracticeImportEntrySchema = BestPracticeSchema.omit({
  meta: true,
}).extend({
  checklistItems: z
    .array(ChecklistItemSchema.omit({ bestPracticeId: true, meta: true }))
    .default([]),
  codeSnippets: z.array(CodeSnippetSchema.omit({ bestPracticeId: true, meta: true })).default([]),
});
export type BestPracticeImportEntry = z.infer<typeof BestPracticeImportEntrySchema>;
