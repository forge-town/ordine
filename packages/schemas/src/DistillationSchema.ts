import { z } from "zod/v4";
import { AgentRuntimeSchema } from "./AgentRuntimeSchema";
import { MetaSchema } from "./meta";

export const DistillationSourceTypeSchema = z.enum(["job", "pipeline", "manual"]);
export type DistillationSourceType = z.infer<typeof DistillationSourceTypeSchema>;

export const DistillationModeSchema = z.enum(["pipeline", "failure", "prompt", "knowledge"]);
export type DistillationMode = z.infer<typeof DistillationModeSchema>;

export const DistillationStatusSchema = z.enum(["draft", "running", "completed", "failed"]);
export type DistillationStatus = z.infer<typeof DistillationStatusSchema>;

export const DistillationConfigSchema = z.object({
  objective: z.string().default(""),
  systemPrompt: z.string().optional(),
  agent: AgentRuntimeSchema.optional(),
  model: z.string().optional(),
});
export type DistillationConfig = z.infer<typeof DistillationConfigSchema>;

export const DistillationArtifactTypeSchema = z.enum([
  "prompt_patch",
  "pipeline_template",
  "failure_pattern",
  "knowledge_card",
]);
export type DistillationArtifactType = z.infer<typeof DistillationArtifactTypeSchema>;

export const DistillationArtifactSchema = z.object({
  type: DistillationArtifactTypeSchema,
  title: z.string(),
  content: z.string(),
});
export type DistillationArtifact = z.infer<typeof DistillationArtifactSchema>;

export const DistillationCompletedResultSchema = z.object({
  type: z.literal("completed"),
  summary: z.string(),
  insights: z.array(z.string()).default([]),
  minimalPath: z.array(z.string()).default([]),
  reusableAssets: z.array(DistillationArtifactSchema).default([]),
  nextActions: z.array(z.string()).default([]),
});
export type DistillationCompletedResult = z.infer<typeof DistillationCompletedResultSchema>;

export const DistillationFailedResultSchema = z.object({
  type: z.literal("failed"),
  error: z.string(),
  raw: z.string().optional(),
});
export type DistillationFailedResult = z.infer<typeof DistillationFailedResultSchema>;

export const DistillationResultSchema = z.union([
  DistillationCompletedResultSchema,
  DistillationFailedResultSchema,
]);
export type DistillationResult = z.infer<typeof DistillationResultSchema>;

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
