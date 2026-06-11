import { z } from "zod/v4";
import { PipelineNodeSchema } from "./node/PipelineNodeSchema";
import { PipelineEdgeSchema } from "./edge/PipelineEdgeSchema";
import { PipelineStatusSchema } from "./PipelineStatusSchema";

export const PipelineSchema = z.object({
  id: z.string(),
  projectId: z.string().nullable().default(null),
  name: z.string(),
  description: z.string().default(""),
  status: PipelineStatusSchema.default("draft"),
  version: z.number().int().min(1).default(1),
  tags: z.array(z.string()),
  timeoutMs: z.number().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  nodes: z.array(PipelineNodeSchema),
  edges: z.array(PipelineEdgeSchema),
});
export type PipelineData = z.infer<typeof PipelineSchema>;
