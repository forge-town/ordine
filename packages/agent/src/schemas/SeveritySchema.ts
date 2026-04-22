import { z } from "zod/v4";

export const SEVERITY_ENUM = {
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
} as const;

export const SeveritySchema = z.enum(SEVERITY_ENUM);
export type Severity = z.infer<typeof SeveritySchema>;
