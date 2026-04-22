import { z } from "zod/v4";

export const RULE_SCRIPT_LANGUAGE_ENUM = {
  TYPESCRIPT: "typescript",
  BASH: "bash",
} as const;

export const RuleScriptLanguageSchema = z.enum(RULE_SCRIPT_LANGUAGE_ENUM);
export type RuleScriptLanguage = z.infer<typeof RuleScriptLanguageSchema>;
