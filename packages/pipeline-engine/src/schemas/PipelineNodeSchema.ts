import { z } from "zod/v4";
import { NodeTypeSchema } from "./NodeTypeSchema";
import { MetaNodeTypeSchema } from "./MetaNodeTypeSchema";
import { PipelineNodeDataSchema } from "./PipelineNodeDataSchema";

export const PipelineNodeSchema = z.object({
  id: z.string(),
  type: NodeTypeSchema,
  metaType: MetaNodeTypeSchema.optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: PipelineNodeDataSchema,
});
export type PipelineNode = z.infer<typeof PipelineNodeSchema>;
