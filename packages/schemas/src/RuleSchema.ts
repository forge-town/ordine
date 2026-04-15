import { z } from "zod/v4";

export const RuleCategorySchema = z.enum([
  "lint",
  "security",
  "style",
  "performance",
  "structure",
  "testing",
  "custom",
]);
export type RuleCategory = z.infer<typeof RuleCategorySchema>;

export const RuleSeveritySchema = z.enum(["error", "warning", "info"]);
export type RuleSeverity = z.infer<typeof RuleSeveritySchema>;

export const RuleScriptLanguageSchema = z.enum(["typescript", "bash"]);
export type RuleScriptLanguage = z.infer<typeof RuleScriptLanguageSchema>;

/**
 * The object passed to a rule's default-export check function.
 * The script must export default: (target: RuleTarget) => boolean | Promise<boolean>
 * Return true = pass, false = fail.
 */
export interface RuleTarget {
  path: string;
  type: "file" | "folder" | "project";
}
