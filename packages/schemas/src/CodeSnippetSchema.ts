import { z } from "zod/v4";

export const CodeSnippetSchema = z.object({
  id: z.string(),
  bestPracticeId: z.string(),
  title: z.string().default(""),
  language: z.string().default("typescript"),
  code: z.string().default(""),
  sortOrder: z.number().int().default(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type CodeSnippet = z.infer<typeof CodeSnippetSchema>;
