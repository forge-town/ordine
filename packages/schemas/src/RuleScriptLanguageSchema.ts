import { z } from "zod/v4";

export const RuleScriptLanguageSchema = z.enum(["typescript", "bash"]);
export type RuleScriptLanguage = z.infer<typeof RuleScriptLanguageSchema>;
