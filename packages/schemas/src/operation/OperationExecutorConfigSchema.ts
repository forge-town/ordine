import { z } from "zod/v4";
import { OperationExecutorTypeSchema } from "./OperationExecutorTypeSchema";
import { AgentModeSchema } from "../agent/AgentModeSchema";
import { AgentRuntimeSchema } from "../agent-runtime/AgentRuntimeSchema";
import { ScriptLanguageSchema } from "../common/ScriptLanguageSchema";

export const OperationExecutorConfigSchema = z.object({
  type: OperationExecutorTypeSchema,
  agentMode: AgentModeSchema.optional(),
  agent: AgentRuntimeSchema.optional(),
  skillId: z.string().optional(),
  systemPrompt: z.string().optional(),
  prompt: z.string().optional(),
  command: z.string().optional(),
  language: ScriptLanguageSchema.optional(),
  allowedTools: z.array(z.string()).optional(),
});
export type OperationExecutorConfig = z.infer<typeof OperationExecutorConfigSchema>;
