import { ResultAsync, Result, errAsync } from "neverthrow";
import { dirname } from "node:path";
import { statSync } from "node:fs";
import { runClaude, runCodex, type SettingsResolver } from "@repo/agent";
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

      if (agent === "local-claude") {
        const startTime = Date.now();
        const claudeResult = await runClaude({
          systemPrompt: prompt,
          userPrompt: inputContent,
          cwd,
          allowedTools: [],
          onProgress,
        });
        const raw = claudeResult.text;
        logger.info({ outputLen: raw.length }, "runPrompt: claude complete");
        await onProgress?.(`[LLM] runPrompt: Claude complete, output=${raw.length} chars`);
        if (onChunk) await onChunk(raw);

        if (jobId) {
          const obsResult = await recordPromptRun({
            jobId,
            agentSystem: "local-claude",
            systemPrompt: prompt,
            userPrompt: inputContent,
            output: raw,
            durationMs: Date.now() - startTime,
          });
          if (obsResult.isErr()) {
            logger.warn({ err: obsResult.error }, "runPrompt: failed to record claude run");
          }
        }

        return raw;
      }

      if (agent === "codex") {
        const startTime = Date.now();
        const codexResult = await runCodex({
          systemPrompt: prompt,
          userPrompt: inputContent,
          cwd,
          onProgress,
        });
        logger.info({ outputLen: codexResult.length }, "runPrompt: codex complete");
        await onProgress?.(`[LLM] runPrompt: Codex complete, output=${codexResult.length} chars`);
        if (onChunk) await onChunk(codexResult);

        if (jobId) {
          const obsResult = await recordPromptRun({
            jobId,
            agentSystem: "codex",
            systemPrompt: prompt,
            userPrompt: inputContent,
            output: codexResult,
            durationMs: Date.now() - startTime,
          });
          if (obsResult.isErr()) {
            logger.warn({ err: obsResult.error }, "runPrompt: failed to record codex run");
          }
        }

        return codexResult;
      }

      throw new PromptExecutionError(`Unsupported agent backend: "${agent}"`);
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
