import { z } from "zod/v4";
import { RefinementRoundSchema } from "./RefinementRoundSchema";
import { RefinementStatusSchema } from "./RefinementStatusSchema";

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
