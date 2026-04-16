import { z } from "zod/v4";

export const ExecutorTypeSchema = z.enum(["agent", "script", "rule-check"]);
export type ExecutorType = z.infer<typeof ExecutorTypeSchema>;

export const AgentModeSchema = z.enum(["skill", "prompt"]);
export type AgentMode = z.infer<typeof AgentModeSchema>;

export const AgentBackendSchema = z.enum(["local-claude", "kimi"]);
export type AgentBackend = z.infer<typeof AgentBackendSchema>;

export const ScriptLanguageSchema = z.enum(["bash", "python", "javascript"]);
export type ScriptLanguage = z.infer<typeof ScriptLanguageSchema>;

export const ExecutorConfigSchema = z.object({
  type: ExecutorTypeSchema,
  agentMode: AgentModeSchema.optional(),
  agent: AgentBackendSchema.optional(),
  skillId: z.string().optional(),
  prompt: z.string().optional(),
  command: z.string().optional(),
  language: ScriptLanguageSchema.optional(),
  writeEnabled: z.boolean().optional(),
  allowedTools: z.array(z.string()).optional(),
  promptMode: z.enum(["code", "research"]).optional(),
});
export type ExecutorConfig = z.infer<typeof ExecutorConfigSchema>;
