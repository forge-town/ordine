import { z } from "zod/v4";
import { NodeTypeSchema } from "./NodeType.js";
import { PipelineNodeDataSchema } from "./PipelineNodeData.js";

export const PipelineNodeSchema = z.object({
  id: z.string(),
  type: NodeTypeSchema,
  position: z.object({ x: z.number(), y: z.number() }),
  data: PipelineNodeDataSchema,
});
export type PipelineNode = z.infer<typeof PipelineNodeSchema>;
