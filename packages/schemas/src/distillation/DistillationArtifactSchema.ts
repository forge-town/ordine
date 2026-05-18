import { z } from "zod/v4";
import { DistillationArtifactTypeSchema } from "./DistillationArtifactTypeSchema";

export const DistillationArtifactSchema = z.object({
  type: DistillationArtifactTypeSchema,
  title: z.string(),
  content: z.string(),
});
export type DistillationArtifact = z.infer<typeof DistillationArtifactSchema>;
