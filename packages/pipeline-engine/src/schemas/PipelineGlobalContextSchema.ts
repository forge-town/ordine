import { z } from "zod/v4";

export const PipelineGlobalContextSchema = z.object({
  name: z.string(),
  description: z.string(),
  purpose: z.string().optional(),
});
export type PipelineGlobalContext = z.infer<typeof PipelineGlobalContextSchema>;
