import { z } from "zod/v4";

export const LogLevelSchema = z.enum(["info", "warn", "error", "debug"]);
export type LogLevel = z.infer<typeof LogLevelSchema>;
