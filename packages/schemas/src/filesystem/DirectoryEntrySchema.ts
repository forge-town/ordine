import { z } from "zod/v4";

export const DirectoryEntryTypeSchema = z.enum(["file", "directory"]);
export type DirectoryEntryType = z.infer<typeof DirectoryEntryTypeSchema>;

export const DirectoryEntrySchema = z.object({
  name: z.string(),
  type: DirectoryEntryTypeSchema,
  path: z.string(),
});
export type DirectoryEntry = z.infer<typeof DirectoryEntrySchema>;
