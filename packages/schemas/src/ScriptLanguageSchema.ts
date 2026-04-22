import { z } from "zod/v4";

export const ScriptLanguageSchema = z.enum(["bash", "python", "javascript"]);
export type ScriptLanguage = z.infer<typeof ScriptLanguageSchema>;
