import { z } from "zod/v4";
import { PipelineEdgeDataSchema } from "./PipelineEdgeDataSchema";

// TODO: React Flow produces null for sourceHandle/targetHandle when
// connecting from the node body rather than a specific handle. Ideally
// we should avoid null in our model and convert to actual handle IDs at
// the edge-creation boundary (handleConnect), but that requires aligning
// with decorateEdgesWithPortHandles logic. For now, nullable().optional()
// keeps validation compatible with runtime data.
export const PipelineEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  data: PipelineEdgeDataSchema.optional(),
});
export type PipelineEdge = z.infer<typeof PipelineEdgeSchema>;
