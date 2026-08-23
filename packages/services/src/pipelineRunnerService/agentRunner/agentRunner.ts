import { ResultAsync } from "neverthrow";
import {
  agentEngine,
  type AgentInputAttachment,
  type McpConnectorInjectionProvider,
} from "@repo/agent-engine";
import { logger } from "@repo/logger";
import { TRACE_MARKER, type AgentRuntime, type SshConnection } from "@repo/schemas";
import { resolveCwd } from "../resolveCwd";

export type { McpConnectorInjectionProvider } from "@repo/agent-engine";

export interface AgentRunnerOptions {
  agent: AgentRuntime;
  systemPrompt: string;
  userPrompt: string;
  inputPath: string;
  jobId?: string;
  agentId: string;
  allowedTools?: readonly string[];
  onProgress?: (line: string) => Promise<void> | void;
  onTextDelta?: (text: string) => Promise<void> | void;
  logPrefix: string;
  attachments?: AgentInputAttachment[];
  apiKey?: string;
  model?: string;
  reasoningEffort?: string;
  speed?: string;
  runtimeConfigId?: string;
  executablePath?: string;
  githubToken?: string;
  ssh?: SshConnection;
  getMcpConnectorInjection?: McpConnectorInjectionProvider;
  signal?: AbortSignal;
}

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
    onTextDelta,
    logPrefix,
    attachments,
    apiKey,
    model,
    reasoningEffort,
    speed,
    runtimeConfigId,
    executablePath,
    githubToken,
    getMcpConnectorInjection,
    signal,
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

  const engineResult = await ResultAsync.fromPromise(
    agentEngine.run({
      agent,
      mode: "direct",
      systemPrompt,
      userPrompt,
      cwd,
      attachments,
      allowedTools: allowedTools ?? [],
      onProgress,
      onTextDelta,
      jobId,
      agentId,
      apiKey,
      model,
      reasoningEffort,
      speed,
      runtimeConfigId,
      executablePath,
      githubToken,
      ssh: opts.ssh,
      getMcpConnectorInjection,
      signal,
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
