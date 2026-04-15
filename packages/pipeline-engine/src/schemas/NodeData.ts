import { z } from "zod/v4";
import { OutputModeSchema } from "./OutputMode.js";

export const NodeDataSchema = z.object({
  nodeType: z.string().optional(),
  folderPath: z.string().optional(),
  excludedPaths: z.array(z.string()).optional(),
  disclosureMode: z.enum(["tree", "full", "files-only"]).optional(),
  includedExtensions: z.array(z.string()).optional(),
  filePath: z.string().optional(),
  localPath: z.string().optional(),
  operationId: z.string().optional(),
  outputFileName: z.string().optional(),
  outputMode: OutputModeSchema.optional(),
});
export type NodeData = z.infer<typeof NodeDataSchema>;
