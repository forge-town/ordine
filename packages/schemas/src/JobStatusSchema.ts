import { z } from "zod/v4";

export const JOB_STATUS_ENUM = {
  QUEUED: "queued",
  RUNNING: "running",
  DONE: "done",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

export const JobStatusSchema = z.enum(JOB_STATUS_ENUM);
export type JobStatus = z.infer<typeof JobStatusSchema>;
