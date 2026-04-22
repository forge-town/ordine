import { z } from "zod/v4";
import { ExecutorTypeSchema } from "./ExecutorTypeSchema";
import { AgentModeSchema } from "./AgentModeSchema";
import { AgentRuntimeSchema } from "./AgentRuntimeSchema";
import { ScriptLanguageSchema } from "./ScriptLanguageSchema";

export const ExecutorConfigSchema = z.object({
  type: ExecutorTypeSchema,
  agentMode: AgentModeSchema.optional(),
  agent: AgentRuntimeSchema.optional(),
  skillId: z.string().optional(),
  prompt: z.string().optional(),
  command: z.string().optional(),
  language: ScriptLanguageSchema.optional(),
  writeEnabled: z.boolean().optional(),
  allowedTools: z.array(z.string()).optional(),
  promptMode: z.enum(["code", "research"]).optional(),
});
export type ExecutorConfig = z.infer<typeof ExecutorConfigSchema>;
