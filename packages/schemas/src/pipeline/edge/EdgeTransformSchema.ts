import { z } from "zod/v4";

/** Transform edge (post-P0, schema reserved ahead of implementation). */
export const EdgeTransformStepSchema = z.object({
  type: z.string(),
  config: z.record(z.string(), z.unknown()),
});
export type EdgeTransformStep = z.infer<typeof EdgeTransformStepSchema>;

export const EdgeTransformSchema = z.object({
  steps: z.array(EdgeTransformStepSchema),
});
export type EdgeTransform = z.infer<typeof EdgeTransformSchema>;
