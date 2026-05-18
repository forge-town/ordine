import { z } from "zod/v4";
import { DistillationArtifactSchema } from "./DistillationArtifactSchema";

export const DistillationCompletedResultSchema = z.object({
  type: z.literal("completed"),
  summary: z.string(),
  insights: z.array(z.string()).default([]),
  minimalPath: z.array(z.string()).default([]),
  reusableAssets: z.array(DistillationArtifactSchema).default([]),
  nextActions: z.array(z.string()).default([]),
});
export type DistillationCompletedResult = z.infer<typeof DistillationCompletedResultSchema>;
