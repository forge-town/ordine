import { z } from "zod/v4";

export const ChecklistItemSchema = z.object({
  id: z.string(),
  bestPracticeId: z.string(),
  title: z.string(),
  description: z.string().default(""),
  checkType: z.enum(["script", "llm"]).default("llm"),
  script: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
