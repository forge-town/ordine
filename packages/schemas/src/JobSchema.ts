import { z } from "zod/v4";

export const JobStatusSchema = z.enum(["queued", "running", "done", "failed", "cancelled"]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const JobTypeSchema = z.enum([
  "pipeline_run",
  "code_analysis",
  "skill_execution",
  "file_scan",
  "custom",
]);
export type JobType = z.infer<typeof JobTypeSchema>;
