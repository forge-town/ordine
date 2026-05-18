import { z } from "zod/v4";

export const REFINEMENT_STATUS_ENUM = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
export const RefinementStatusSchema = z.enum(REFINEMENT_STATUS_ENUM);
export type RefinementStatus = z.infer<typeof RefinementStatusSchema>;
