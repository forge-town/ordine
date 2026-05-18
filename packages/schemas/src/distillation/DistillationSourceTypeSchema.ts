import { z } from "zod/v4";

export const DISTILLATION_SOURCE_TYPE_ENUM = {
  JOB: "job",
  PIPELINE: "pipeline",
  MANUAL: "manual",
} as const;
export const DistillationSourceTypeSchema = z.enum(DISTILLATION_SOURCE_TYPE_ENUM);
export type DistillationSourceType = z.infer<typeof DistillationSourceTypeSchema>;
