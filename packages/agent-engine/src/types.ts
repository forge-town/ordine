import { type AgentRunPermissionMode, type AgentRuntime, type RuntimeEvent } from "@repo/schemas";
import type {
  AgentInputAttachment as RuntimeAgentInputAttachment,
  ClaudeStreamEvent,
  McpConnectorInjection,
  SshConnectionOptions,
} from "@repo/agent";

export type AgentInputAttachment = RuntimeAgentInputAttachment;

/**
 * Runtime-agnostic usage totals. `null` when the runtime cannot report usage
 * (only claude can today) — never a fabricated 0.
 */
export interface AgentUsage {
  input: number;
  output: number;
}

/**
 * Public return contract of `agentEngine.run`.
 * Only runtime-agnostic fields are exposed; the claude-specific event stream
 * (ClaudeStreamEvent) stays a driver-internal detail and no longer leaks into
 * the package's public types.
 */
export interface AgentRunOutcome {
  text: string;
  usage: AgentUsage | null;
}

/**
 * Internal driver return: claude carries its event stream back for
 * observability, every other runtime returns an empty array.
 * Shared across internal files (drivers / obs) but NOT exported from the
 * package index.
 */
export interface DriverResult {
  text: string;
  events: ClaudeStreamEvent[];
}

export type McpConnectorInjectionProvider = (
  selectedToolNames: readonly string[],
  agent?: AgentRuntime,
) => Promise<McpConnectorInjection | null>;

export interface AgentRunOptions {
  agent: AgentRuntime;
  mode: "direct";
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  attachments?: AgentInputAttachment[];
  allowedTools?: readonly string[];
  onProgress?: (msg: string) => Promise<void> | void;
  onTextDelta?: (text: string) => Promise<void> | void;
  onRuntimeEvent?: (event: RuntimeEvent) => Promise<void> | void;
  signal?: AbortSignal;
  jobId?: string;
  agentId?: string;
  apiKey?: string;
  model?: string;
  reasoningEffort?: string;
  speed?: string;
  resumeSessionId?: string;
  executablePath?: string;
  permissionMode?: AgentRunPermissionMode;
  networkAccess?: boolean;
  supportsPartialMessages?: boolean;
  supportsPermissionBypass?: boolean;
  runtimeConfigId?: string;
  resumeFromRunId?: string;
  rebuildPrompt?: string;
  fullAccessConfirmed?: boolean;
  githubToken?: string;
  ssh?: SshConnectionOptions;
  connectorInjection?: McpConnectorInjection;
  getMcpConnectorInjection?: McpConnectorInjectionProvider;
}
