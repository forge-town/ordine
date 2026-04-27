import { z } from "zod/v4";

export const JOB_TYPE_ENUM = {
  PIPELINE_RUN: "pipeline_run",
  CODE_ANALYSIS: "code_analysis",
  SKILL_EXECUTION: "skill_execution",
  FILE_SCAN: "file_scan",
  CUSTOM: "custom",
} as const;

export const JobTypeSchema = z.enum(JOB_TYPE_ENUM);
export type JobType = z.infer<typeof JobTypeSchema>;
