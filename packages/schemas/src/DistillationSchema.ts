import { z } from "zod/v4";
import { MetaSchema } from "./meta";

export const DistillationSourceTypeSchema = z.enum(["job", "pipeline", "manual"]);
export type DistillationSourceType = z.infer<typeof DistillationSourceTypeSchema>;

export const DistillationModeSchema = z.enum(["pipeline", "failure", "prompt", "knowledge"]);
export type DistillationMode = z.infer<typeof DistillationModeSchema>;

export const DistillationStatusSchema = z.enum(["draft", "running", "completed", "failed"]);
export type DistillationStatus = z.infer<typeof DistillationStatusSchema>;

export const DistillationConfigSchema = z.record(z.string(), z.unknown());
export type DistillationConfig = z.infer<typeof DistillationConfigSchema>;

export const DistillationSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().default(""),
  sourceType: DistillationSourceTypeSchema,
  sourceId: z.string().nullable(),
  sourceLabel: z.string().default(""),
  mode: DistillationModeSchema,
  status: DistillationStatusSchema,
  config: DistillationConfigSchema.default({}),
  inputSnapshot: z.unknown().nullable(),
  result: z.unknown().nullable(),
  meta: MetaSchema.optional(),
});
export type Distillation = z.infer<typeof DistillationSchema>;
