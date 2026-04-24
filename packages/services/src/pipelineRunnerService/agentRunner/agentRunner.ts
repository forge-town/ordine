import { ResultAsync } from "neverthrow";
import { agentEngine } from "@repo/agent-engine";
import { logger } from "@repo/logger";
import type { AgentRuntime } from "@repo/schemas";
import { resolveCwd } from "../resolveCwd";

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
  apiKey?: string;
  model?: string;
  githubToken?: string;
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
    logPrefix,
    apiKey,
    model,
    githubToken,
  } = opts;

  logger.info(
    { systemLen: systemPrompt.length, userLen: userPrompt.length, agent },
    `${logPrefix}: starting`,
  );
  await onProgress?.(
    `${logPrefix}: agent=${agent}, system length=${systemPrompt.length}, input length=${userPrompt.length}`,
  );

  const cwd = resolveCwd({ inputPath });

  const engineResult = await ResultAsync.fromPromise(
    agentEngine.run({
      agent,
      mode: "direct",
      systemPrompt,
      userPrompt,
      cwd,
      allowedTools: allowedTools ?? [],
      onProgress,
      jobId,
      agentId,
      apiKey,
      model,
      githubToken,
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
