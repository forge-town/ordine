import { z } from "zod/v4";

export const RefinementStatusSchema = z.enum(["pending", "running", "completed", "failed"]);
export type RefinementStatus = z.infer<typeof RefinementStatusSchema>;

export const RefinementRoundStatusSchema = z.enum([
  "pending",
  "optimizing",
  "running",
  "distilling",
  "completed",
  "failed",
]);
export type RefinementRoundStatus = z.infer<typeof RefinementRoundStatusSchema>;

export const RefinementRoundSchema = z.object({
  round: z.number().int().positive(),
  pipelineId: z.string().nullable().default(null),
  jobId: z.string().nullable().default(null),
  distillationId: z.string().nullable().default(null),
  status: RefinementRoundStatusSchema.default("pending"),
  summary: z.string().default(""),
  error: z.string().nullable().default(null),
});
export type RefinementRound = z.infer<typeof RefinementRoundSchema>;

export const RefinementSchema = z.object({
  id: z.string(),
  sourceDistillationId: z.string(),
  maxRounds: z.number().int().positive().default(3),
  currentRound: z.number().int().default(0),
  status: RefinementStatusSchema.default("pending"),
  rounds: z.array(RefinementRoundSchema).default([]),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});
export type Refinement = z.infer<typeof RefinementSchema>;
