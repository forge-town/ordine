import { z } from "zod/v4";
import { OBJECT_TYPES } from "@/models/tables/operations_table";

export const ObjectTypeSchema = z.enum(OBJECT_TYPES);
export type ObjectType = z.infer<typeof ObjectTypeSchema>;

export const ExecutorTypeSchema = z.enum(["agent", "script"]);
export type ExecutorType = z.infer<typeof ExecutorTypeSchema>;

export const AgentModeSchema = z.enum(["skill", "prompt"]);
export type AgentMode = z.infer<typeof AgentModeSchema>;

export const ScriptLanguageSchema = z.enum(["bash", "python", "javascript"]);
export type ScriptLanguage = z.infer<typeof ScriptLanguageSchema>;
