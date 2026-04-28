import { z } from "zod/v4";
import { MetaSchema } from "./meta";

export const RefinementRunSchema = z.object({
  id: z.string(),
  refinementId: z.string(),
  sourceDistillationId: z.string(),
  meta: MetaSchema.optional(),
});
export type RefinementRun = z.infer<typeof RefinementRunSchema>;
