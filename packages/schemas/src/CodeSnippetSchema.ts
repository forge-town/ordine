import { z } from "zod/v4";

export const CodeSnippetSchema = z.object({
  id: z.string(),
  bestPracticeId: z.string(),
  title: z.string().default(""),
  language: z.string().default("typescript"),
  code: z.string().default(""),
  sortOrder: z.number().int().default(0),
});

export type CodeSnippet = z.infer<typeof CodeSnippetSchema>;
