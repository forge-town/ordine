import { z } from "zod/v4";

export const AGENT_RUNTIME_ENUM = {
  CLAUDE_CODE: "claude-code",
  CODEX: "codex",
  HERMES: "hermes",
  MASTRA: "mastra",
  OPENCLAW: "openclaw",
} as const;
export const AgentRuntimeSchema = z.enum(AGENT_RUNTIME_ENUM);
export type AgentRuntime = z.infer<typeof AgentRuntimeSchema>;

export const DEFAULT_AGENT_RUNTIME_ENUM = {
  CLAUDE_CODE: AGENT_RUNTIME_ENUM.CLAUDE_CODE,
  CODEX: AGENT_RUNTIME_ENUM.CODEX,
  MASTRA: AGENT_RUNTIME_ENUM.MASTRA,
  OPENCLAW: AGENT_RUNTIME_ENUM.OPENCLAW,
} as const;
export const DefaultAgentRuntimeSchema = z.enum(DEFAULT_AGENT_RUNTIME_ENUM);
export type DefaultAgentRuntime = z.infer<typeof DefaultAgentRuntimeSchema>;
