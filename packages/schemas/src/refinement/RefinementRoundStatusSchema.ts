import { z } from "zod/v4";

export const REFINEMENT_ROUND_STATUS_ENUM = {
  PENDING: "pending",
  OPTIMIZING: "optimizing",
  RUNNING: "running",
  DISTILLING: "distilling",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;
export const RefinementRoundStatusSchema = z.enum(REFINEMENT_ROUND_STATUS_ENUM);
export type RefinementRoundStatus = z.infer<typeof RefinementRoundStatusSchema>;
