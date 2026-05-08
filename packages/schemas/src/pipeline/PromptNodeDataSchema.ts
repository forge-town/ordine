import { z } from "zod/v4";

export const PromptNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("prompt"),
  prompt: z.string(),
  description: z.string().optional(),
});
export type PromptNodeData = z.infer<typeof PromptNodeDataSchema>;
