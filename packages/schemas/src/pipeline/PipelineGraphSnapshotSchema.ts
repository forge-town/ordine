import { z } from "zod/v4";
import { PipelineNodeSchema } from "./node/PipelineNodeSchema";
import { PipelineEdgeSchema } from "./edge/PipelineEdgeSchema";

export const PipelineGraphNodeSchema = PipelineNodeSchema.extend({
  parentId: z.string().optional(),
}).catchall(z.unknown());
export type PipelineGraphNode = z.infer<typeof PipelineGraphNodeSchema>;

export const PipelineGraphEdgeSchema = PipelineEdgeSchema.catchall(z.unknown());
export type PipelineGraphEdge = z.infer<typeof PipelineGraphEdgeSchema>;

export const PipelineGraphSnapshotSchema = z.object({
  nodes: z.array(PipelineGraphNodeSchema),
  edges: z.array(PipelineGraphEdgeSchema),
});
export type PipelineGraphSnapshot = z.infer<typeof PipelineGraphSnapshotSchema>;
