import { z } from "zod/v4";

export const DistillationFailedResultSchema = z.object({
  type: z.literal("failed"),
  error: z.string(),
  raw: z.string().optional(),
});
export type DistillationFailedResult = z.infer<typeof DistillationFailedResultSchema>;
