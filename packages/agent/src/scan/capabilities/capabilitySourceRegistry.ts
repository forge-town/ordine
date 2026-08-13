import type { AgentRuntime, CapabilitySourceId } from "@repo/schemas";
import type { CapabilitySupport } from "./capabilitySchemas";

export const RUNTIME_CAPABILITY_SUPPORT = {
  "claude-code": { mcp: "supported", skills: "supported" },
  codex: { mcp: "supported", skills: "supported" },
  hermes: { mcp: "supported", skills: "supported" },
  mastra: { mcp: "not_applicable", skills: "not_applicable" },
  openclaw: { mcp: "supported", skills: "supported" },
  "pi-agent": { mcp: "unsupported", skills: "supported" },
  opencode: { mcp: "supported", skills: "supported" },
  "kimi-code": { mcp: "supported", skills: "supported" },
} as const satisfies Record<AgentRuntime, CapabilitySupport>;

export const EXTRA_CAPABILITY_SOURCE_SUPPORT = {
  cursor: { mcp: "supported", skills: "supported" },
} as const satisfies Record<Exclude<CapabilitySourceId, AgentRuntime>, CapabilitySupport>;

export const CAPABILITY_SOURCE_SUPPORT = {
  ...RUNTIME_CAPABILITY_SUPPORT,
  ...EXTRA_CAPABILITY_SOURCE_SUPPORT,
} as const satisfies Record<CapabilitySourceId, CapabilitySupport>;
