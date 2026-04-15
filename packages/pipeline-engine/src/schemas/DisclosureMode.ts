import { z } from "zod/v4";

export const DisclosureModeSchema = z.enum(["tree", "full", "files-only"]);
export type DisclosureMode = z.infer<typeof DisclosureModeSchema>;
