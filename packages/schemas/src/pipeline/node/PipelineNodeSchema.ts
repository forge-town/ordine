import { z } from "zod/v4";
import { BuiltinNodeTypeSchema } from "./BuiltinNodeTypeSchema";
import { MetaNodeTypeSchema } from "./MetaNodeTypeSchema";
import { PipelineNodeDataSchema } from "../node-data/PipelineNodeDataSchema";

export const PipelineNodeSchema = z.object({
  id: z.string(),
  type: BuiltinNodeTypeSchema,
  metaType: MetaNodeTypeSchema.optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: PipelineNodeDataSchema,
});
export type PipelineNode = z.infer<typeof PipelineNodeSchema>;
