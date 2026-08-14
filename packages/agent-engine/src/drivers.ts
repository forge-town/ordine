import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  hasMcpConnectorInjection,
  runClaude,
  runCodex,
  runHermes,
  runKimiCode,
  runMastra,
  runOpenclaw,
  runOpencode,
  runPiAgent,
  type McpConnectorInjection,
  type ToolName,
} from "@repo/agent";
import { logger } from "@repo/logger";
import type { AgentRuntime } from "@repo/schemas";
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

type PreparedClaudeMcpInjection = {
  configPath: string;
  toolNames: readonly string[];
};

const describeConnectorInjection = (injection: McpConnectorInjection): string =>
  injection.toolNames.length > 0
    ? injection.toolNames.join(", ")
    : Object.keys(injection.mcpServers).join(", ");

const selectedConnectorToolNames = (opts: AgentRunOptions): readonly string[] =>
  opts.allowedTools?.filter((toolName) => toolName.startsWith("mcp__")) ?? [];

const runtimeToolNames = (opts: AgentRunOptions): readonly string[] | undefined =>
  opts.allowedTools?.filter((toolName) => !toolName.startsWith("mcp__"));

const loadConnectorInjection = async (
  opts: AgentRunOptions,
): Promise<McpConnectorInjection | undefined> => {
  if (hasMcpConnectorInjection(opts.connectorInjection)) return opts.connectorInjection;
  const selectedTools = selectedConnectorToolNames(opts);
  if (!opts.getMcpConnectorInjection || selectedTools.length === 0) return undefined;

  return (await opts.getMcpConnectorInjection(selectedTools, opts.agent)) ?? undefined;
};

const hasRequestedConnectorInjection = (opts: AgentRunOptions): boolean =>
  hasMcpConnectorInjection(opts.connectorInjection) ||
  (!!opts.getMcpConnectorInjection && selectedConnectorToolNames(opts).length > 0);

const writeClaudeMcpConfig = async (
  injection: McpConnectorInjection,
): Promise<PreparedClaudeMcpInjection> => {
  const configPath = join(tmpdir(), `ordine-claude-mcp-${crypto.randomUUID()}.json`);
  await writeFile(
    configPath,
    `${JSON.stringify({ mcpServers: injection.mcpServers }, null, 2)}\n`,
    { mode: 0o600 },
  );

  return { configPath, toolNames: injection.toolNames };
};

const cleanupClaudeMcpConfig = async ({
  configPath,
  agent,
}: {
  configPath: string;
  agent: AgentRuntime;
}): Promise<void> => {
  const cleanup = await rm(configPath, { force: true }).then(
    () => null,
    (error) => error,
  );
  if (cleanup) {
    logger.warn({ err: cleanup, configPath, agent }, "connector injection: cleanup failed");
  }
};

const reportConnectorInjectionSkipped = async (
  opts: AgentRunOptions,
  reason: string,
): Promise<void> => {
  if (!hasRequestedConnectorInjection(opts)) return;

  logger.warn({ agent: opts.agent, reason }, "connector injection skipped");
  await opts.onProgress?.(`[Connector Injection] ${opts.agent} skipped: ${reason}`);
};

const runLocalClaudeDirect = async (opts: AgentRunOptions): Promise<DriverResult> => {
  const extraEnv = opts.githubToken ? { GITHUB_TOKEN: opts.githubToken } : undefined;
  const selectedRuntimeTools = runtimeToolNames(opts);
  const effectiveTools =
    selectedRuntimeTools && selectedRuntimeTools.length > 0
      ? (selectedRuntimeTools as ToolName[])
      : undefined;

  if (opts.ssh) {
    await reportConnectorInjectionSkipped(
      opts,
      "SSH runtime cannot access a local generated MCP config",
    );
  }

  const connectorInjection = opts.ssh ? undefined : await loadConnectorInjection(opts);
  const preparedMcp = !hasMcpConnectorInjection(connectorInjection)
    ? null
    : await writeClaudeMcpConfig(connectorInjection);

  const runWithMcp = (async () => {
    if (preparedMcp && connectorInjection) {
      await opts.onProgress?.(
        `[Connector Injection] claude-code injected: ${describeConnectorInjection(connectorInjection)}`,
      );
    }

    return runClaude({
      systemPrompt: opts.systemPrompt,
      userPrompt: opts.userPrompt,
      cwd: opts.cwd,
      ...(effectiveTools ? { allowedTools: effectiveTools } : {}),
      onProgress: toAsyncProgress(opts.onProgress),
      extraEnv,
      ssh: opts.ssh,
      mcpConfigPath: preparedMcp?.configPath,
      mcpToolNames: preparedMcp ? [...preparedMcp.toolNames] : undefined,
    });
  })();

  const result = await runWithMcp.finally(async () => {
    if (preparedMcp) {
      await cleanupClaudeMcpConfig({ configPath: preparedMcp.configPath, agent: opts.agent });
    }
  });

  return { text: result.text, events: result.events };
};

const runCodexDirect = async (opts: AgentRunOptions): Promise<DriverResult> => {
  if (opts.ssh) {
    await reportConnectorInjectionSkipped(opts, "Codex SSH runtime is not supported yet");
    throw new Error("Codex SSH runtime is not supported yet");
  }

  const connectorInjection = await loadConnectorInjection(opts);
  if (connectorInjection) {
    await opts.onProgress?.(
      `[Connector Injection] codex injected: ${describeConnectorInjection(connectorInjection)}`,
    );
  }

  const text = await runCodex({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    cwd: opts.cwd,
    onProgress: toAsyncProgress(opts.onProgress),
    connectorInjection,
  });

  return { text, events: [] };
};

const runMastraDirect = async (opts: AgentRunOptions): Promise<DriverResult> => {
  await reportConnectorInjectionSkipped(
    opts,
    "runtime adapter does not yet support run-level MCP injection",
  );

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
  await reportConnectorInjectionSkipped(
    opts,
    "runtime adapter does not yet support run-level MCP injection",
  );

  const result = await runHermes({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    cwd: opts.cwd,
    allowedTools: runtimeToolNames(opts),
    onProgress: toAsyncProgress(opts.onProgress),
  });

  if (result.isErr()) {
    // Unified error channel: throw like every other driver instead of returning a rejected promise.
    throw result.error;
  }

  return { text: result.value, events: [] };
};

const runOpenclawDirect = async (opts: AgentRunOptions): Promise<DriverResult> => {
  await reportConnectorInjectionSkipped(
    opts,
    "runtime adapter does not yet support run-level MCP injection",
  );

  const result = await runOpenclaw({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    cwd: opts.cwd,
    onProgress: toAsyncProgress(opts.onProgress),
  });

  return { text: result.text, events: [] };
};

const runPiAgentDirect = async (opts: AgentRunOptions): Promise<DriverResult> => {
  await reportConnectorInjectionSkipped(
    opts,
    "runtime adapter does not yet support run-level MCP injection",
  );

  const result = await runPiAgent({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    cwd: opts.cwd,
    model: opts.model,
    onProgress: toAsyncProgress(opts.onProgress),
  });

  if (result.isErr()) {
    // Unified error channel: throw like every other driver instead of returning a rejected promise.
    throw result.error;
  }

  return { text: result.value, events: [] };
};

const runOpencodeDirect = async (opts: AgentRunOptions): Promise<DriverResult> => {
  await reportConnectorInjectionSkipped(
    opts,
    "runtime adapter does not yet support run-level MCP injection",
  );

  const result = await runOpencode({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    cwd: opts.cwd,
    model: opts.model,
    onProgress: toAsyncProgress(opts.onProgress),
  });

  if (result.isErr()) {
    // Unified error channel: throw like every other driver instead of returning a rejected promise.
    throw result.error;
  }

  return { text: result.value, events: [] };
};

const runKimiCodeDirect = async (opts: AgentRunOptions): Promise<DriverResult> => {
  const connectorInjection = await loadConnectorInjection(opts);
  if (connectorInjection) {
    await opts.onProgress?.(
      `[Connector Injection] kimi-code injected: ${describeConnectorInjection(connectorInjection)}`,
    );
  }

  const result = await runKimiCode({
    systemPrompt: opts.systemPrompt,
    userPrompt: opts.userPrompt,
    cwd: opts.cwd,
    model: opts.model,
    onProgress: toAsyncProgress(opts.onProgress),
    connectorInjection,
  });

  if (result.isErr()) {
    // Unified error channel: throw like every other driver instead of returning a rejected promise.
    throw result.error;
  }

  return { text: result.value, events: [] };
};

export const DRIVERS: Record<AgentRuntime, DriverFn> = {
  "claude-code": runLocalClaudeDirect,
  codex: runCodexDirect,
  hermes: runHermesDirect,
  mastra: runMastraDirect,
  openclaw: runOpenclawDirect,
  "pi-agent": runPiAgentDirect,
  opencode: runOpencodeDirect,
  "kimi-code": runKimiCodeDirect,
};
