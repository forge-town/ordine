import { z } from "zod/v4";
import { OutputModeSchema } from "./OutputModeSchema";

export const LocalPathOutputNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("output-local-path"),
  localPath: z
    .string()
    .describe("Output directory. Put the filename in outputFileName instead of appending it here."),
  outputFileName: z
    .string()
    .optional()
    .describe("Base filename for the generated output artifact."),
  outputMode: OutputModeSchema.optional(),
  description: z.string().optional(),
});
export type LocalPathOutputNodeData = z.infer<typeof LocalPathOutputNodeDataSchema>;
