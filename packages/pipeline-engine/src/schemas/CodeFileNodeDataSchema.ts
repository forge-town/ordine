import { z } from "zod/v4";

export const CodeFileNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("code-file"),
  filePath: z.string(),
  language: z.string().optional(),
  description: z.string().optional(),
});
export type CodeFileNodeData = z.infer<typeof CodeFileNodeDataSchema>;
