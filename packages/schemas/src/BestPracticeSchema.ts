import { z } from "zod/v4";
import { MetaSchema } from "./meta";

export const BestPracticeSchema = z.object({
  id: z.string(),
  title: z.string(),
  condition: z.string(),
  content: z.string().default(""),
  category: z.string().default("general"),
  language: z.string().default("typescript"),
  codeSnippet: z.string().default(""),
  tags: z.array(z.string()).default([]),

  meta: MetaSchema,
});
export type BestPractice = z.infer<typeof BestPracticeSchema>;
