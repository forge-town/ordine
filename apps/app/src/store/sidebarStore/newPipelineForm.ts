import { z } from "zod/v4";

export const newPipelineFormSchema = z.object({
  name: z.string(),
  description: z.string(),
});

export type NewPipelineFormValues = z.infer<typeof newPipelineFormSchema>;
