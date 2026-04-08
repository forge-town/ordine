import { z } from "zod/v4";

export const BestPracticeSchema = z.object({
  id: z.string(),
  title: z.string(),
  condition: z.string(),
  category: z.string().default("general"),
  language: z.string().default("typescript"),
  codeSnippet: z.string().default(""),
  tags: z.array(z.string()).default([]),
});

export type BestPractice = z.infer<typeof BestPracticeSchema>;
