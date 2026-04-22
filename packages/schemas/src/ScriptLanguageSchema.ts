import { z } from "zod/v4";

export const SCRIPT_LANGUAGE_ENUM = {
  BASH: "bash",
  PYTHON: "python",
  JAVASCRIPT: "javascript",
} as const;

export const ScriptLanguageSchema = z.enum(SCRIPT_LANGUAGE_ENUM);
export type ScriptLanguage = z.infer<typeof ScriptLanguageSchema>;
