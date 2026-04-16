import { z } from "zod/v4";

export const CompoundNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("compound"),
  childNodeIds: z.array(z.string()),
  description: z.string().optional(),
});
export type CompoundNodeData = z.infer<typeof CompoundNodeDataSchema>;
