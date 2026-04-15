import { z } from "zod/v4";

export const PipelineSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  nodeCount: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
});

export type Pipeline = z.infer<typeof PipelineSchema>;
