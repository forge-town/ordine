import { z } from "zod/v4";

/** Conditional edge (post-P0, schema reserved ahead of implementation). */
export const EdgeConditionSchema = z.object({
  expression: z.string(),
  fallbackTarget: z.string().optional(),
});
export type EdgeCondition = z.infer<typeof EdgeConditionSchema>;
