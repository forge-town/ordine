import { type AgentRuntime } from "@repo/schemas";
import type { ClaudeStreamEvent, SshConnectionOptions } from "@repo/agent";

/** Runtime 无关的用量。无法采集（非 claude runtime）时为 null，诚实表达"不可用"而非伪造 0。 */
export interface AgentUsage {
  input: number;
  output: number;
}

/**
 * agentEngine.run 的公开返回契约（H1-03）。
 * 仅暴露 runtime 无关字段；claude 专属的事件流（ClaudeStreamEvent）保留为 driver 内部细节，
 * 不再穿透到包公开类型。
 */
export interface AgentRunOutcome {
  text: string;
  usage: AgentUsage | null;
}

/**
 * Driver 内部返回：claude 会带回事件流用于观测，其余 runtime 为空数组。
 * 跨内部文件共享（drivers / obs），但**不**从包 index 公开导出。
 */
export interface DriverResult {
  text: string;
  events: ClaudeStreamEvent[];
}

export interface AgentRunOptions {
  agent: AgentRuntime;
  mode: "direct";
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  allowedTools?: readonly string[];
  onProgress?: (msg: string) => Promise<void> | void;
  jobId?: string;
  agentId?: string;
  apiKey?: string;
  model?: string;
  githubToken?: string;
  ssh?: SshConnectionOptions;
}
