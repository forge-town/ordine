import { z } from "zod/v4";

export const AGENT_RUNTIME_ENUM = {
  CLAUDE_CODE: "claude-code",
  CODEX: "codex",
  MASTRA: "mastra",
} as const;

export const AgentRuntimeSchema = z.enum(AGENT_RUNTIME_ENUM);
export type AgentRuntime = z.infer<typeof AgentRuntimeSchema>;
