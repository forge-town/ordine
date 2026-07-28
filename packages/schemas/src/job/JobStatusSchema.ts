import { z } from "zod/v4";

export const JOB_STATUS_ENUM = {
  QUEUED: "queued",
  RUNNING: "running",
  PAUSED: "paused",
  DONE: "done",
  FAILED: "failed",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  SKIPPED: "skipped",
} as const;
export const JobStatusSchema = z.enum(JOB_STATUS_ENUM);
export type JobStatus = z.infer<typeof JobStatusSchema>;
