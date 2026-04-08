import { z } from "zod/v4";

export const RuleCategorySchema = z.enum(["lint", "security", "style", "performance", "custom"]);
export type RuleCategory = z.infer<typeof RuleCategorySchema>;

export const RuleSeveritySchema = z.enum(["error", "warning", "info"]);
export type RuleSeverity = z.infer<typeof RuleSeveritySchema>;
