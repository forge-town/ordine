import { z } from "zod/v4";
import { ToolNameSchema } from "./ToolNameSchema";

const MAX_SYSTEM_PROMPT_CHARS = 10_000;

export const SshConnectionOptionsSchema = z.object({
  host: z.string(),
  user: z.string(),
  port: z.number().int().positive().optional(),
  keyPath: z.string().optional(),
});

export type SshConnectionOptions = z.infer<typeof SshConnectionOptionsSchema>;

export const RunClaudeOptionsSchema = z.object({
  systemPrompt: z.string().max(MAX_SYSTEM_PROMPT_CHARS),
  userPrompt: z.string(),
  cwd: z.string(),
  allowedTools: z.array(ToolNameSchema).readonly().optional(),
  timeoutMs: z.number().optional(),
  maxBudgetUsd: z.number().optional(),
  onProgress: z.custom<(line: string) => Promise<void>>().optional(),
  extraEnv: z.record(z.string(), z.string()).optional(),
  ssh: SshConnectionOptionsSchema.optional(),
  // N22-05：connector 注入。mcpConfigPath 指向生成的 MCP 配置文件（--mcp-config）；
  // mcpToolNames 是 `mcp__<server>__<tool>` 形式的额外工具名（不受 ToolNameSchema 枚举约束）。
  mcpConfigPath: z.string().optional(),
  mcpToolNames: z.array(z.string()).optional(),
});

export type RunClaudeOptions = z.infer<typeof RunClaudeOptionsSchema>;
