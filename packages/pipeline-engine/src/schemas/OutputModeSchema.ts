import { z } from "zod/v4";

export const OUTPUT_MODES = ["overwrite", "error_if_exists", "auto_rename"] as const;
export const OutputModeSchema = z.enum(OUTPUT_MODES);
export type OutputMode = z.infer<typeof OutputModeSchema>;
