import { z } from "zod/v4";
import { OperationExecutorTypeSchema } from "./OperationExecutorTypeSchema";
import { AgentModeSchema } from "../agent/AgentModeSchema";
import { AgentRuntimeSchema } from "../agent-runtime/AgentRuntimeSchema";
import { ScriptLanguageSchema } from "../common/ScriptLanguageSchema";

const GitPublishConfigSchema = z.object({
  target: z.literal("git"),
  repo: z.string().min(1),
  branch: z.string().min(1),
  subPath: z.string().optional(),
  commitMessage: z.string().optional(),
  openPr: z.boolean().optional().default(true),
});

const LocalDirPublishConfigSchema = z.object({
  target: z.literal("localDir"),
  outputDir: z.string().min(1),
});

export const PublishConfigSchema = z.discriminatedUnion("target", [
  GitPublishConfigSchema,
  LocalDirPublishConfigSchema,
]);
export type PublishConfig = z.infer<typeof PublishConfigSchema>;

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
  /** Publish 配置。当前执行器枚举未激活 PUBLISH，此字段处于待命状态。 */
  publish: PublishConfigSchema.optional(),
});
export type OperationExecutorConfig = z.infer<typeof OperationExecutorConfigSchema>;
