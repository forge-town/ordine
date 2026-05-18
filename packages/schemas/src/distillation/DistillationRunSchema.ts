import { z } from "zod/v4";
import { MetaSchema } from "../meta";
import { DistillationResultSchema } from "./DistillationResultSchema";

export const DistillationRunSchema = z.object({
  id: z.string(),
  distillationId: z.string(),
  inputSnapshot: z.unknown().nullable(),
  result: DistillationResultSchema.nullable(),
  meta: MetaSchema.optional(),
});
export type DistillationRun = z.infer<typeof DistillationRunSchema>;
