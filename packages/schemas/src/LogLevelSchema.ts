import { z } from "zod/v4";

export const LOG_LEVEL_ENUM = {
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
  DEBUG: "debug",
} as const;
export const LogLevelSchema = z.enum(LOG_LEVEL_ENUM);
export type LogLevel = z.infer<typeof LogLevelSchema>;
