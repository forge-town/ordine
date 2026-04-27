import { z } from "zod/v4";

export const JOB_TYPE_ENUM = {
  PIPELINE_RUN: "pipeline_run",
  DISTILLATION_RUN: "distillation_run",
  REFINEMENT_RUN: "refinement_run",
} as const;

export const JobTypeSchema = z.enum(JOB_TYPE_ENUM);
export type JobType = z.infer<typeof JobTypeSchema>;
