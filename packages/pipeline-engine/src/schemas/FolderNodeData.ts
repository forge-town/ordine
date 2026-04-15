import { z } from "zod/v4";
import { DisclosureModeSchema } from "./DisclosureMode.js";

export const FolderNodeDataSchema = z.object({
  label: z.string(),
  nodeType: z.literal("folder"),
  folderPath: z.string(),
  excludedPaths: z.array(z.string()).optional(),
  disclosureMode: DisclosureModeSchema.optional(),
  includedExtensions: z.array(z.string()).optional(),
  description: z.string().optional(),
});
export type FolderNodeData = z.infer<typeof FolderNodeDataSchema>;
