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
  onAssistantChunk: z.custom<(text: string) => Promise<void> | void>().optional(),
  extraEnv: z.record(z.string(), z.string()).optional(),
  ssh: SshConnectionOptionsSchema.optional(),
  // Connector injection: mcpConfigPath points at a generated MCP config file
  // (passed via --mcp-config); mcpToolNames are extra tool names of the form
  // `mcp__<server>__<tool>` (not constrained by the ToolNameSchema enum).
  mcpConfigPath: z.string().optional(),
  mcpToolNames: z.array(z.string()).optional(),
});

export type RunClaudeOptions = z.infer<typeof RunClaudeOptionsSchema>;
