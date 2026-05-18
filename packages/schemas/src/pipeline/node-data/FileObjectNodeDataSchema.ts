import { z } from "zod/v4";

export const FileObjectNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("file"),
  filePath: z.string(),
  language: z.string().optional(),
  description: z.string().optional(),
});
export type FileObjectNodeData = z.infer<typeof FileObjectNodeDataSchema>;
