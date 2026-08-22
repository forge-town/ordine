import { z } from "zod/v4";

export const AGENT_RUNTIME_ENUM = {
  CLAUDE_CODE: "claude-code",
  CODEX: "codex",
  HERMES: "hermes",
  DEEPSEEK_HARNESS: "deepseek-harness",
  MASTRA: "mastra",
  MISTRAL_VIBE: "mistral-vibe",
  OPENCLAW: "openclaw",
  PI_AGENT: "pi-agent",
  OPENCODE: "opencode",
  KIMI_CODE: "kimi-code",
  DEEPSEEK_REASONIX: "deepseek-reasonix",
  KIRO: "kiro",
  TRAE: "trae",
} as const;
export const AgentRuntimeSchema = z.enum(AGENT_RUNTIME_ENUM);
export type AgentRuntime = z.infer<typeof AgentRuntimeSchema>;

export const LOCAL_AGENT_RUNTIME_ID_PREFIX = "local-";

export const getLocalAgentRuntimeId = (runtime: AgentRuntime) =>
  `${LOCAL_AGENT_RUNTIME_ID_PREFIX}${runtime}`;

export const parseLocalAgentRuntimeId = (runtimeId: string): AgentRuntime | null => {
  if (!runtimeId.startsWith(LOCAL_AGENT_RUNTIME_ID_PREFIX)) {
    return null;
  }

  const parsed = AgentRuntimeSchema.safeParse(
    runtimeId.slice(LOCAL_AGENT_RUNTIME_ID_PREFIX.length),
  );

  return parsed.success ? parsed.data : null;
};

export const DEFAULT_AGENT_RUNTIME_ENUM = {
  CLAUDE_CODE: AGENT_RUNTIME_ENUM.CLAUDE_CODE,
  CODEX: AGENT_RUNTIME_ENUM.CODEX,
  DEEPSEEK_HARNESS: AGENT_RUNTIME_ENUM.DEEPSEEK_HARNESS,
  MASTRA: AGENT_RUNTIME_ENUM.MASTRA,
  MISTRAL_VIBE: AGENT_RUNTIME_ENUM.MISTRAL_VIBE,
  OPENCLAW: AGENT_RUNTIME_ENUM.OPENCLAW,
  PI_AGENT: AGENT_RUNTIME_ENUM.PI_AGENT,
  OPENCODE: AGENT_RUNTIME_ENUM.OPENCODE,
  KIMI_CODE: AGENT_RUNTIME_ENUM.KIMI_CODE,
  DEEPSEEK_REASONIX: AGENT_RUNTIME_ENUM.DEEPSEEK_REASONIX,
  KIRO: AGENT_RUNTIME_ENUM.KIRO,
  TRAE: AGENT_RUNTIME_ENUM.TRAE,
} as const;
export const DefaultAgentRuntimeSchema = z.enum(DEFAULT_AGENT_RUNTIME_ENUM);
export type DefaultAgentRuntime = z.infer<typeof DefaultAgentRuntimeSchema>;
