import { z } from "zod/v4";

export const RULE_SEVERITY_ENUM = {
  ERROR: "error",
  WARNING: "warning",
  INFO: "info",
} as const;

export const RuleSeveritySchema = z.enum(RULE_SEVERITY_ENUM);
export type RuleSeverity = z.infer<typeof RuleSeveritySchema>;
