import { z } from "zod/v4";
import { DistillationResultSchema } from "./DistillationSchema";
import { MetaSchema } from "./meta";

export const DistillationRunSchema = z.object({
  id: z.string(),
  distillationId: z.string(),
  inputSnapshot: z.unknown().nullable(),
  result: DistillationResultSchema.nullable(),
  meta: MetaSchema.optional(),
});
export type DistillationRun = z.infer<typeof DistillationRunSchema>;
