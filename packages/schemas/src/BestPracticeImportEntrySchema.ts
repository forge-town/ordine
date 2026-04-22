import { z } from "zod/v4";
import { BestPracticeSchema } from "./BestPracticeSchema";
import { ChecklistItemSchema } from "./ChecklistItemSchema";
import { CodeSnippetSchema } from "./CodeSnippetSchema";

export const BestPracticeImportEntrySchema = BestPracticeSchema.extend({
  checklistItems: z.array(ChecklistItemSchema.omit({ bestPracticeId: true })).default([]),
  codeSnippets: z.array(CodeSnippetSchema.omit({ bestPracticeId: true })).default([]),
});
export type BestPracticeImportEntry = z.infer<typeof BestPracticeImportEntrySchema>;
