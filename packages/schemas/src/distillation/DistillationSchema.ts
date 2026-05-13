import { z } from "zod/v4";
import { MetaSchema } from "../meta";
import { DistillationConfigSchema } from "./DistillationConfigSchema";
import { DistillationModeSchema } from "./DistillationModeSchema";
import { DistillationResultSchema } from "./DistillationResultSchema";
import { DistillationSourceTypeSchema } from "./DistillationSourceTypeSchema";
import { DistillationStatusSchema } from "./DistillationStatusSchema";

export const DistillationSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().default(""),
  sourceType: DistillationSourceTypeSchema,
  sourceId: z.string().nullable(),
  sourceLabel: z.string().default(""),
  mode: DistillationModeSchema,
  status: DistillationStatusSchema,
  config: DistillationConfigSchema.default({ objective: "" }),
  inputSnapshot: z.unknown().nullable(),
  result: DistillationResultSchema.nullable(),
  meta: MetaSchema.optional(),
});
export type Distillation = z.infer<typeof DistillationSchema>;
