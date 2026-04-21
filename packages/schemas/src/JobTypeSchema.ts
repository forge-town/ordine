import { z } from "zod/v4";

export const JobTypeSchema = z.enum([
  "pipeline_run",
  "code_analysis",
  "skill_execution",
  "file_scan",
  "custom",
]);
export type JobType = z.infer<typeof JobTypeSchema>;
