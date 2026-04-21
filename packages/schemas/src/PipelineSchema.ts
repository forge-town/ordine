import { z } from "zod/v4";
import { PipelineNodeSchema, PipelineEdgeSchema } from "@repo/pipeline-engine/schemas";

export const PipelineSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  timeoutMs: z.number().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
  nodes: z.array(PipelineNodeSchema),
  edges: z.array(PipelineEdgeSchema),
});

export type Pipeline = z.infer<typeof PipelineSchema>;
