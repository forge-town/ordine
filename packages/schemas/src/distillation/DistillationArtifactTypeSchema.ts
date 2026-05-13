import { z } from "zod/v4";

export const DISTILLATION_ARTIFACT_TYPE_ENUM = {
  PROMPT_PATCH: "prompt_patch",
  PIPELINE_TEMPLATE: "pipeline_template",
  FAILURE_PATTERN: "failure_pattern",
  KNOWLEDGE_CARD: "knowledge_card",
} as const;
export const DistillationArtifactTypeSchema = z.enum(DISTILLATION_ARTIFACT_TYPE_ENUM);
export type DistillationArtifactType = z.infer<typeof DistillationArtifactTypeSchema>;
