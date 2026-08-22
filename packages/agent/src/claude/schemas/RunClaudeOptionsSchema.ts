import { z } from "zod/v4";
import type { AgentRunPermissionMode, RuntimeEvent } from "@repo/schemas";
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
  model: z.string().optional(),
  reasoningEffort: z.string().min(1).optional(),
  speed: z.string().min(1).optional(),
  executablePath: z.string().min(1).optional(),
  allowedTools: z.array(ToolNameSchema).readonly().optional(),
  timeoutMs: z.number().optional(),
  maxBudgetUsd: z.number().optional(),
  onProgress: z.custom<(line: string) => Promise<void>>().optional(),
  onTextDelta: z.custom<(text: string) => Promise<void> | void>().optional(),
  onRuntimeEvent: z.custom<(event: RuntimeEvent) => Promise<void> | void>().optional(),
  signal: z.custom<AbortSignal>().optional(),
  permissionMode: z.custom<AgentRunPermissionMode>().optional(),
  fullAccessConfirmed: z.boolean().optional(),
  networkAccess: z.boolean().optional(),
  supportsPartialMessages: z.boolean().optional(),
  supportsReasoningEffort: z.boolean().optional(),
  resumeSessionId: z.string().min(1).optional(),
  sessionId: z.string().uuid().optional(),
  extraEnv: z.record(z.string(), z.string()).optional(),
  ssh: SshConnectionOptionsSchema.optional(),
  // Connector injection: mcpConfigPath points at a generated MCP config file
  // (passed via --mcp-config); mcpToolNames are extra tool names of the form
  // `mcp__<server>__<tool>` (not constrained by the ToolNameSchema enum).
  mcpConfigPath: z.string().optional(),
  mcpToolNames: z.array(z.string()).optional(),
});

export type RunClaudeOptions = z.infer<typeof RunClaudeOptionsSchema>;
