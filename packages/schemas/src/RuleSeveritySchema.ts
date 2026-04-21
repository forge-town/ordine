import { z } from "zod/v4";

export const RuleSeveritySchema = z.enum(["error", "warning", "info"]);
export type RuleSeverity = z.infer<typeof RuleSeveritySchema>;
