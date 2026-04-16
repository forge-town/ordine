import { z } from "zod/v4";
import { PipelineEdgeDataSchema } from "./PipelineEdgeDataSchema.js";

export const PipelineEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  data: PipelineEdgeDataSchema.optional(),
});
export type PipelineEdge = z.infer<typeof PipelineEdgeSchema>;
