import { z } from "zod/v4";

export const DISTILLATION_MODE_ENUM = {
  PIPELINE: "pipeline",
  FAILURE: "failure",
  PROMPT: "prompt",
  KNOWLEDGE: "knowledge",
} as const;
export const DistillationModeSchema = z.enum(DISTILLATION_MODE_ENUM);
export type DistillationMode = z.infer<typeof DistillationModeSchema>;
