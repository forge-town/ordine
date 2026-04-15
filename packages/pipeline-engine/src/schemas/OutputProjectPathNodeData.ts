import { z } from "zod/v4";

export const OutputProjectPathNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("output-project-path"),
  projectId: z.string().optional(),
  path: z.string(),
  description: z.string().optional(),
});
export type OutputProjectPathNodeData = z.infer<typeof OutputProjectPathNodeDataSchema>;
