import { z } from "zod/v4";

export const PipelineGlobalContextSchema = z.object({
  name: z.string(),
  description: z.string(),
  sharedContext: z.string(),
});
export type PipelineGlobalContext = z.infer<typeof PipelineGlobalContextSchema>;
