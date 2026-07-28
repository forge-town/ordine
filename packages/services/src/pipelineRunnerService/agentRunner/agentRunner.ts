import { rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ResultAsync } from "neverthrow";
import { agentEngine, type AgentInputAttachment } from "@repo/agent-engine";
import { logger } from "@repo/logger";
import { TRACE_MARKER, type AgentRuntime, type SshConnection } from "@repo/schemas";
import type { ClaudeMcpInjection } from "../../connectorsService";
import { resolveCwd } from "../resolveCwd";

export type ClaudeMcpInjectionProvider = () => Promise<ClaudeMcpInjection | null>;

export interface AgentRunnerOptions {
  agent: AgentRuntime;
  systemPrompt: string;
  userPrompt: string;
  inputPath: string;
  jobId?: string;
  agentId: string;
  allowedTools?: readonly string[];
  onProgress?: (line: string) => Promise<void> | void;
  logPrefix: string;
  attachments?: AgentInputAttachment[];
  apiKey?: string;
  model?: string;
  githubToken?: string;
  ssh?: SshConnection;
  getClaudeMcpInjection?: ClaudeMcpInjectionProvider;
}

type PreparedClaudeMcpInjection = {
  configPath: string;
  toolNames: string[];
};

const writeClaudeMcpConfig = async (
  injection: ClaudeMcpInjection,
): Promise<PreparedClaudeMcpInjection> => {
  const configPath = join(tmpdir(), `ordine-claude-mcp-${crypto.randomUUID()}.json`);
  await writeFile(
    configPath,
    `${JSON.stringify({ mcpServers: injection.mcpServers }, null, 2)}\n`,
    { mode: 0o600 },
  );

  return { configPath, toolNames: injection.toolNames };
};

const prepareClaudeMcpInjection = async ({
  agent,
  ssh,
  getClaudeMcpInjection,
}: {
  agent: AgentRuntime;
  ssh?: SshConnection;
  getClaudeMcpInjection?: ClaudeMcpInjectionProvider;
}): Promise<PreparedClaudeMcpInjection | null> => {
  if (agent !== "claude-code") return null;
  if (ssh) return null;
  if (!getClaudeMcpInjection) return null;

  const injection = await getClaudeMcpInjection();
  if (!injection) return null;

  return writeClaudeMcpConfig(injection);
};

const cleanupClaudeMcpConfig = async ({
  configPath,
  logPrefix,
}: {
  configPath: string;
  logPrefix: string;
}): Promise<void> => {
  const cleanup = await ResultAsync.fromPromise(rm(configPath, { force: true }), (error) => error);
  if (cleanup.isErr()) {
    logger.warn({ err: cleanup.error, configPath }, `${logPrefix}: failed to remove MCP config`);
  }
};

export const runAgent = async (opts: AgentRunnerOptions): Promise<string> => {
  const {
    agent,
    systemPrompt,
    userPrompt,
    inputPath,
    jobId,
    agentId,
    allowedTools,
    onProgress,
    logPrefix,
    attachments,
    apiKey,
    model,
    githubToken,
    getClaudeMcpInjection,
  } = opts;

  logger.info(
    { systemLen: systemPrompt.length, userLen: userPrompt.length, agent },
    `${logPrefix}: starting`,
  );
  await onProgress?.(
    `${logPrefix}: agent=${agent}, system length=${systemPrompt.length}, input length=${userPrompt.length}`,
  );

  const cwdResult = resolveCwd({ inputPath });
  if (cwdResult.isErr()) {
    // Structured user-action marker: flows into job_traces via onProgress so the
    // frontend can render a configuration guidance card. The node still fails.
    await onProgress?.(
      `${TRACE_MARKER.userAction}${JSON.stringify({
        kind: "configure-input",
        message: `Input path "${inputPath}" does not exist — configure an existing input folder or file for this node.`,
        field: "inputPath",
      })}`,
    );
    await onProgress?.(`${logPrefix}: Error — ${cwdResult.error.message}`);

    throw cwdResult.error;
  }
  const cwd = cwdResult.value;

  if (agent === "claude-code" && opts.ssh && getClaudeMcpInjection) {
    logger.warn({ agent, host: opts.ssh.host }, `${logPrefix}: MCP tools skipped for SSH runtime`);
    await onProgress?.(`${logPrefix}: MCP tools skipped for SSH runtime`);
  }

  const mcpInjectionResult = await ResultAsync.fromPromise(
    prepareClaudeMcpInjection({ agent, ssh: opts.ssh, getClaudeMcpInjection }),
    (error) => error,
  );
  if (mcpInjectionResult.isErr()) {
    const errMsg =
      mcpInjectionResult.error instanceof Error
        ? mcpInjectionResult.error.message
        : String(mcpInjectionResult.error);
    logger.error({ err: errMsg, agent }, `${logPrefix}: MCP injection setup failed`);
    await onProgress?.(`${logPrefix}: MCP injection setup FAILED — ${errMsg}`);
    throw new Error(`${agent} MCP injection setup failed: ${errMsg}`, {
      cause: mcpInjectionResult.error,
    });
  }
  const mcpInjection = mcpInjectionResult.value;

  const runWithMcpInjection = (async () => {
    if (mcpInjection) {
      await onProgress?.(`${logPrefix}: MCP tools injected — ${mcpInjection.toolNames.join(", ")}`);
    }

    return agentEngine.run({
      agent,
      mode: "direct",
      systemPrompt,
      userPrompt,
      cwd,
      attachments,
      allowedTools: allowedTools ?? [],
      onProgress,
      jobId,
      agentId,
      apiKey,
      model,
      githubToken,
      ssh: opts.ssh,
      mcpConfigPath: mcpInjection?.configPath,
      mcpToolNames: mcpInjection?.toolNames,
    });
  })();

  const engineResult = await ResultAsync.fromPromise(
    runWithMcpInjection.finally(async () => {
      if (mcpInjection) {
        await cleanupClaudeMcpConfig({ configPath: mcpInjection.configPath, logPrefix });
      }
    }),
    (error) => error,
  );

  if (engineResult.isErr()) {
    const error = engineResult.error;
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error({ err: errMsg, agent }, `${logPrefix}: agent failed`);
    await onProgress?.(`${logPrefix}: ${agent} FAILED — ${errMsg}`);
    throw new Error(`${agent} agent failed: ${errMsg}`, { cause: error });
  }

  const raw = engineResult.value.text;
  logger.info({ outputLen: raw.length, agent }, `${logPrefix}: agent complete`);
  await onProgress?.(`${logPrefix}: ${agent} complete, output=${raw.length} chars`);

  return raw;
};
