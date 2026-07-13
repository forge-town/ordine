import { z } from "zod/v4";

export const PIPELINE_STATUS_ENUM = {
  DRAFT: "draft",
  READY: "ready",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
  ARCHIVED: "archived",
} as const;
export const PipelineStatusSchema = z.enum(PIPELINE_STATUS_ENUM);
export type PipelineStatus = z.infer<typeof PipelineStatusSchema>;
