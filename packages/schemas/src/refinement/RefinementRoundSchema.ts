import { z } from "zod/v4";
import { RefinementRoundStatusSchema } from "./RefinementRoundStatusSchema";

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
