import { runClaude, runCodex, type ClaudeStreamEvent, type ToolName } from "@repo/agent";
import { AgentBackend } from "@repo/schemas";

export interface AgentRunResult {
  text: string;
  events: ClaudeStreamEvent[];
}

export interface AgentRunOptions {
  agent: AgentBackend;
  mode: "direct";
  systemPrompt: string;
  userPrompt: string;
  cwd: string;
  allowedTools?: readonly ToolName[];
  onProgress?: (msg: string) => Promise<void> | void;
}

const toAsyncProgress = (
  onProgress?: AgentRunOptions["onProgress"],
): ((line: string) => Promise<void>) | undefined => {
  if (!onProgress) {
    return undefined;
  }

  return async (line: string) => {
    await onProgress(line);
  };
};

const runLocalClaudeDirect = async (opts: AgentRunOptions): Promise<AgentRunResult> => {
  const result = await runClaude({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    cwd: opts.cwd,
    allowedTools: opts.allowedTools ?? [],
    onProgress: toAsyncProgress(opts.onProgress),
  });
  return { text: result.text, events: result.events };
};

const runCodexDirect = async (opts: AgentRunOptions): Promise<AgentRunResult> => {
  const text = await runCodex({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    cwd: opts.cwd,
    onProgress: toAsyncProgress(opts.onProgress),
  });
  return { text, events: [] };
};

type DriverFn = (opts: AgentRunOptions) => Promise<AgentRunResult>;

const DRIVERS: Record<AgentBackend, DriverFn> = {
  "local-claude": runLocalClaudeDirect,
  codex: runCodexDirect,
};

const run = async (opts: AgentRunOptions): Promise<AgentRunResult> => {
  const driver = DRIVERS[opts.agent];
  if (!driver) {
    throw new Error(`Unsupported agent backend: "${opts.agent}"`);
  }
  return driver(opts);
};

export const agentEngine = { run };
