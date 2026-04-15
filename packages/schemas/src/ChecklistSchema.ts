import { z } from "zod/v4";

export const ChecklistItemSchema = z.object({
  id: z.string(),
  bestPracticeId: z.string(),
  title: z.string(),
  description: z.string().default(""),
  checkType: z.enum(["script", "llm"]).default("llm"),
  script: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
});

export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;

export const ChecklistResultSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  checklistItemId: z.string(),
  passed: z.boolean().default(false),
  output: z.string().default(""),
});

export type ChecklistResult = z.infer<typeof ChecklistResultSchema>;
