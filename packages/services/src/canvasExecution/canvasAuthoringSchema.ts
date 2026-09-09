import { z } from "zod/v4";
import { PipelineSchema } from "@repo/schemas";

// React Flow measures and selects nodes while editing. These fields never alter execution.
export const CanvasExecutionNodeSchema = PipelineSchema.shape.nodes.element.strict().extend({
  measured: z
    .strictObject({
      width: z.number().nonnegative().optional(),
      height: z.number().nonnegative().optional(),
    })
    .optional(),
  selected: z.boolean().optional(),
  dragging: z.boolean().optional(),
  resizing: z.boolean().optional(),
  width: z.number().nonnegative().optional(),
  height: z.number().nonnegative().optional(),
  origin: z.tuple([z.number(), z.number()]).optional(),
  zIndex: z.number().optional(),
});
export const CanvasExecutionEdgeSchema = PipelineSchema.shape.edges.element.strict().extend({
  selected: z.boolean().optional(),
  animated: z.boolean().optional(),
});
