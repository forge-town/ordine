import { z } from "zod/v4";

export const ChecklistResultSchema = z.object({
  id: z.string(),
  jobId: z.string(),
  checklistItemId: z.string(),
  passed: z.boolean().default(false),
  output: z.string().default(""),
});

export type ChecklistResult = z.infer<typeof ChecklistResultSchema>;
