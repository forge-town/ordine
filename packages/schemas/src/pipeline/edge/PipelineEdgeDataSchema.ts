import { z } from "zod/v4";

export const PipelineEdgeDataSchema = z.object({
  label: z.string().default(""),
});
export type PipelineEdgeData = z.infer<typeof PipelineEdgeDataSchema>;
