import { z } from "zod/v4";

export const OUTPUT_MODE_ENUM = {
  OVERWRITE: "overwrite",
  ERROR_IF_EXISTS: "error_if_exists",
  AUTO_RENAME: "auto_rename",
} as const;

export const OutputModeSchema = z.enum(OUTPUT_MODE_ENUM);
export type OutputMode = z.infer<typeof OutputModeSchema>;
