import { z } from "zod/v4";
import { PipelineEdgeSchema } from "../pipeline/edge";
import { PipelineNodeSchema } from "../pipeline/node";
import { PipelineAssetInputSlotSchema } from "./PipelineAssetInputSlotSchema";

export const PipelineAssetSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  name: z.string().min(1),
  description: z.string().default(""),
  snapshotNodes: z.array(PipelineNodeSchema),
  snapshotEdges: z.array(PipelineEdgeSchema),
  inputSlots: z.array(PipelineAssetInputSlotSchema).default([]),
  totalRuns: z.number().int().default(0),
  successRate: z.number().min(0).max(1).nullable(),
  avgDurationMs: z.number().int().nullable(),
  tags: z.array(z.string()).default([]),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});
export type PipelineAsset = z.infer<typeof PipelineAssetSchema>;

export const CreatePipelineAssetSchema = PipelineAssetSchema.omit({
  id: true,
  totalRuns: true,
  successRate: true,
  avgDurationMs: true,
  createdAt: true,
  updatedAt: true,
});
export type CreatePipelineAssetInput = z.infer<typeof CreatePipelineAssetSchema>;

export const UpdatePipelineAssetSchema = CreatePipelineAssetSchema.partial();
export type UpdatePipelineAssetInput = z.infer<typeof UpdatePipelineAssetSchema>;
