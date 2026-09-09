import { z } from "zod/v4";

export const PromptObjectNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("prompt"),
  prompt: z.string(),
  valueType: z.enum(["text", "json"]).optional(),
  description: z.string().optional(),
});
export type PromptObjectNodeData = z.infer<typeof PromptObjectNodeDataSchema>;
