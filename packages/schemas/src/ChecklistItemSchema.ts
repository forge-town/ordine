import { z } from "zod/v4";
import { MetaSchema } from "./meta";

export const ChecklistItemSchema = z.object({
  id: z.string(),
  bestPracticeId: z.string(),
  title: z.string(),
  description: z.string().default(""),
  checkType: z.enum(["script", "llm"]).default("llm"),
  script: z.string().nullable().default(null),
  sortOrder: z.number().int().default(0),
  meta: MetaSchema,
});
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
