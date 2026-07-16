import { runClaude, runCodex, runHermes, runMastra, runOpenclaw, type ToolName } from "@repo/agent";
import { AgentRuntime } from "@repo/schemas";
import type { AgentRunOptions, DriverResult } from "./types";

type DriverFn = (opts: AgentRunOptions) => Promise<DriverResult>;

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

const runLocalClaudeDirect = async (opts: AgentRunOptions): Promise<DriverResult> => {
  const extraEnv = opts.githubToken ? { GITHUB_TOKEN: opts.githubToken } : undefined;
  const effectiveTools =
    opts.allowedTools && opts.allowedTools.length > 0
      ? (opts.allowedTools as ToolName[])
      : undefined;
  const result = await runClaude({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    cwd: opts.cwd,
    ...(effectiveTools ? { allowedTools: effectiveTools } : {}),
    onProgress: toAsyncProgress(opts.onProgress),
    extraEnv,
    ssh: opts.ssh,
  });
  return { text: result.text, events: result.events };
};

const runCodexDirect = async (opts: AgentRunOptions): Promise<DriverResult> => {
  const text = await runCodex({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    cwd: opts.cwd,
    onProgress: toAsyncProgress(opts.onProgress),
  });
  return { text, events: [] };
};

const runMastraDirect = async (opts: AgentRunOptions): Promise<DriverResult> => {
  const result = await runMastra({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    cwd: opts.cwd,
    attachments: opts.attachments,
    apiKey: opts.apiKey,
    model: opts.model,
    onProgress: toAsyncProgress(opts.onProgress),
  });
  return result;
};

const runHermesDirect = async (opts: AgentRunOptions): Promise<DriverResult> => {
  const result = await runHermes({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    cwd: opts.cwd,
    model: opts.model,
    allowedTools: opts.allowedTools,
    onProgress: toAsyncProgress(opts.onProgress),
  });

  if (result.isErr()) {
    // Unified error channel: throw like every other driver instead of returning a rejected promise.
    throw result.error;
  }

  return { text: result.value, events: [] };
};

const runOpenclawDirect = async (opts: AgentRunOptions): Promise<DriverResult> => {
  const result = await runOpenclaw({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    cwd: opts.cwd,
    onProgress: toAsyncProgress(opts.onProgress),
  });

  return { text: result.text, events: [] };
};

export const DRIVERS: Record<AgentRuntime, DriverFn> = {
  "claude-code": runLocalClaudeDirect,
  codex: runCodexDirect,
  hermes: runHermesDirect,
  mastra: runMastraDirect,
  openclaw: runOpenclawDirect,
};
