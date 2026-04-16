import { z } from "zod/v4";
import { OutputModeSchema } from "./OutputModeSchema";

export const OutputLocalPathNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("output-local-path"),
  localPath: z.string(),
  outputFileName: z.string().optional(),
  outputMode: OutputModeSchema.optional(),
  dualOutput: z.boolean().optional(),
  description: z.string().optional(),
});
export type OutputLocalPathNodeData = z.infer<typeof OutputLocalPathNodeDataSchema>;
