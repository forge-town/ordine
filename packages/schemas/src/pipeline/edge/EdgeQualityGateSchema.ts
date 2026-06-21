import { z } from "zod/v4";

/** Quality-gate edge (post-P0, schema reserved ahead of implementation). */
export const EdgeQualityGateSchema = z.object({
  criteria: z.string(),
  maxRetries: z.number().int().min(0).optional(),
  onFail: z.enum(["retry", "skip", "fail"]),
});
export type EdgeQualityGate = z.infer<typeof EdgeQualityGateSchema>;
