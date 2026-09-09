import { z } from "zod/v4";
import { OutputModeSchema } from "./OutputModeSchema";

export const LocalPathOutputNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("output-local-path"),
  localPath: z
    .string()
    .describe(
      "Legacy output directory, not a filename. Leave empty for v2 managed artifact output.",
    ),
  storage: z.literal("artifact").optional(),
  outputFileName: z
    .string()
    .optional()
    .describe("Base filename for the generated output artifact."),
  outputMode: OutputModeSchema.optional(),
  description: z.string().optional(),
});
export type LocalPathOutputNodeData = z.infer<typeof LocalPathOutputNodeDataSchema>;
