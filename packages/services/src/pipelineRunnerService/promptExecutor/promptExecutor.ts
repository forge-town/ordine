import { ResultAsync, Result, errAsync } from "neverthrow";
import { dirname } from "node:path";
import { statSync } from "node:fs";
import { type SettingsResolver } from "@repo/agent";
import { agentEngine } from "@repo/agent-engine";
import { logger } from "@repo/logger";
import { recordAgentRunWithSpans } from "@repo/obs";
import type { RunPromptOptions } from "@repo/pipeline-engine";

export class PromptExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PromptExecutionError";
  }
}

type RunPromptExecutorOptions = RunPromptOptions & {
  getSettings: SettingsResolver;
};

const PROMPT_AGENT_ID = "prompt-executor";

const recordPromptRun = ({
  jobId,
  agentSystem,
  systemPrompt,
  userPrompt,
  output,
  modelId,
  tokenInput,
  tokenOutput,
  durationMs,
}: {
  jobId: string;
  agentSystem: "local-claude" | "codex";
  systemPrompt: string;
  userPrompt: string;
  output: string;
  modelId?: string | null;
  tokenInput?: number | null;
  tokenOutput?: number | null;
  durationMs: number;
}) =>
  ResultAsync.fromPromise(
    recordAgentRunWithSpans(
      {
        jobId,
        agentSystem,
        agentId: PROMPT_AGENT_ID,
        modelId,
        rawPayload: {
          system: systemPrompt,
          prompt: userPrompt,
          output,
        },
        tokenInput: tokenInput ?? null,
        tokenOutput: tokenOutput ?? null,
        durationMs,
        status: "completed",
      },
      (rawExportId) => [
        {
          jobId,
          rawExportId,
          spanType: "agent_run" as const,
          name: PROMPT_AGENT_ID,
          input: userPrompt.slice(0, 10_000),
          output: output.slice(0, 10_000),
          modelId: modelId ?? null,
          tokenInput: tokenInput ?? null,
          tokenOutput: tokenOutput ?? null,
          durationMs,
          status: "completed" as const,
          startedAt: new Date(Date.now() - durationMs),
          finishedAt: new Date(),
        },
      ],
    ),
    (error) => error,
  );

/**
 * Resolve inputPath to a valid cwd directory.
 * If it's a file path, use its parent directory.
 */
const resolveCwd = ({ inputPath }: { inputPath: string | undefined }): string => {
  if (!inputPath) return process.cwd();
  const result = Result.fromThrowable(
    () => statSync(inputPath),
    () => undefined,
  )();

  if (result.isOk() && !result.value.isDirectory()) {
    return dirname(inputPath);
  }

  return inputPath;
};

const run = ({
  prompt,
  inputContent,
  inputPath,
  jobId,
  getSettings,
  modelOverride,
  agent = "local-claude",
  onChunk,
  onProgress,
}: RunPromptExecutorOptions): ResultAsync<string, PromptExecutionError> => {
  if (!prompt?.trim()) {
    return errAsync(new PromptExecutionError("Prompt text is empty"));
  }

  return ResultAsync.fromPromise(
    (async () => {
      logger.info(
        { promptLen: prompt.length, inputLen: inputContent.length, agent },
        "runPrompt: starting",
      );
      await onProgress?.(
        `[LLM] runPrompt: agent=${agent}, prompt length=${prompt.length}, input length=${inputContent.length}`,
      );

      const cwd = resolveCwd({ inputPath });
      const startTime = Date.now();

      const engineResult = await ResultAsync.fromPromise(
        agentEngine.run({
          agent,
          mode: "direct",
          systemPrompt: prompt,
          userPrompt: inputContent,
          cwd,
          allowedTools: [],
          onProgress,
        }),
        (error) => error,
      );

      if (engineResult.isErr()) {
        const error = engineResult.error;
        const errMsg = error instanceof Error ? error.message : String(error);
        logger.error({ err: errMsg, agent }, "runPrompt: agent failed");
        await onProgress?.(`[LLM] runPrompt: ${agent} FAILED — ${errMsg}`);

        throw new PromptExecutionError(`${agent} agent failed for prompt: ${errMsg}`, error);
      }

      const raw = engineResult.value.text;
      logger.info({ outputLen: raw.length, agent }, "runPrompt: agent complete");
      await onProgress?.(`[LLM] runPrompt: ${agent} complete, output=${raw.length} chars`);
      if (onChunk) await onChunk(raw);

      if (jobId) {
        const obsResult = await recordPromptRun({
          jobId,
          agentSystem: agent,
          systemPrompt: prompt,
          userPrompt: inputContent,
          output: raw,
          durationMs: Date.now() - startTime,
        });
        if (obsResult.isErr()) {
          logger.warn({ err: obsResult.error, agent }, "runPrompt: failed to record run");
        }
      }

      return raw;
    })(),
    (cause) => {
      logger.error({ err: cause }, "runPrompt: failed");
      void onProgress?.(
        `[LLM] runPrompt: Error — ${cause instanceof Error ? cause.message : String(cause)}`,
      );

      return cause instanceof PromptExecutionError
        ? cause
        : new PromptExecutionError(
            `Prompt execution failed: ${cause instanceof Error ? cause.message : String(cause)}`,
            cause,
          );
    },
  );
};

export const promptExecutor = {
  run,
};
