import { z } from "zod/v4";

export const DISTILLATION_STATUS_ENUM = {
  DRAFT: "draft",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
export const DistillationStatusSchema = z.enum(DISTILLATION_STATUS_ENUM);
export type DistillationStatus = z.infer<typeof DistillationStatusSchema>;
