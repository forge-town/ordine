import { z } from "zod/v4";

export const DISCLOSURE_MODE_ENUM = {
  TREE: "tree",
  FULL: "full",
  FILES_ONLY: "files-only",
} as const;

export const DisclosureModeSchema = z.enum(DISCLOSURE_MODE_ENUM);
export type DisclosureMode = z.infer<typeof DisclosureModeSchema>;
