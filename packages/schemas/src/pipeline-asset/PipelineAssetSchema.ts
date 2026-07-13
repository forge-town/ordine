import { z } from "zod/v4";
import { PipelineEdgeSchema } from "../pipeline/edge";
import { PipelineNodeSchema } from "../pipeline/node";
import { PipelineAssetInputSlotSchema } from "./PipelineAssetInputSlotSchema";

/** DB 中 success_rate 是 Drizzle numeric(5,4)，查询出来为字符串，需要归一化。 */
const SuccessRateValueSchema = z
  .string()
  .refine(
    (v) => {
      const n = Number.parseFloat(v);

      return !Number.isNaN(n) && n >= 0 && n <= 1;
    },
    { message: "successRate must be a decimal between 0 and 1" },
  )
  .transform((v) => Number.parseFloat(v));

export const PipelineAssetSchema = z.object({
  id: z.string(),
  pipelineId: z.string(),
  name: z.string().min(1),
  description: z.string().default(""),
  snapshotNodes: z.array(PipelineNodeSchema),
  snapshotEdges: z.array(PipelineEdgeSchema),
  inputSlots: z.array(PipelineAssetInputSlotSchema).default([]),
  totalRuns: z.number().int().default(0),
  successRate: z.union([z.number().min(0).max(1), SuccessRateValueSchema]).nullable(),
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
