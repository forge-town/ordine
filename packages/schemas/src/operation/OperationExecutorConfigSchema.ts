import { z } from "zod/v4";
import { OperationExecutorTypeSchema } from "./OperationExecutorTypeSchema";
import { PublishTargetSchema } from "./PublishTargetSchema";
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
  // publish 执行器字段（全 optional，保持与 agent/script 配置向后兼容）
  publishTarget: PublishTargetSchema.optional(),
  repo: z.string().optional(),
  branch: z.string().optional(),
  subPath: z.string().optional(),
  commitMessage: z.string().optional(),
  openPr: z.boolean().optional(),
});
export type OperationExecutorConfig = z.infer<typeof OperationExecutorConfigSchema>;
