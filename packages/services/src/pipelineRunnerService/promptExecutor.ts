import { streamText } from "ai";
import { ResultAsync, Result, errAsync } from "neverthrow";
import { dirname } from "node:path";
import { statSync } from "node:fs";
import { getModel, runClaude, runCodex, type SettingsResolver } from "@repo/agent";
import { logger } from "@repo/logger";
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

/**
 * Resolve inputPath to a valid cwd directory.
 * If it's a file path, use its parent directory.
 */
const resolveCwd = (inputPath: string | undefined): string => {
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

export const runPrompt = ({
  prompt,
  inputContent,
  inputPath,
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

      const cwd = resolveCwd(inputPath);

      if (agent === "local-claude") {
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

        return raw;
      }

      if (agent === "codex") {
        const codexResult = await runCodex({
          systemPrompt: prompt,
          userPrompt: inputContent,
          cwd,
          onProgress,
        });
        logger.info({ outputLen: codexResult.length }, "runPrompt: codex complete");
        await onProgress?.(`[LLM] runPrompt: Codex complete, output=${codexResult.length} chars`);
        if (onChunk) await onChunk(codexResult);

        return codexResult;
      }

      // agent === "mastra" — use streaming LLM
      const model = await getModel(getSettings, modelOverride);
      if (!model) {
        logger.error("runPrompt: LLM not configured");
        await onProgress?.("[LLM] runPrompt: LLM not configured, returning error");

        throw new PromptExecutionError("LLM not configured (API key missing in settings)");
      }
      logger.info("runPrompt: streaming (mastra)");
      await onProgress?.("[LLM] runPrompt: Starting streamText (mastra)...");
      const result = streamText({
        model,
        prompt: `${prompt}\n\nInput:\n${inputContent}`,
      });
      const chunks: string[] = [];
      for await (const chunk of result.textStream) {
        chunks.push(chunk);
        if (onChunk) await onChunk(chunks.join(""));
      }
      const accumulated = chunks.join("");
      logger.info({ outputLen: accumulated.length, chunks: chunks.length }, "runPrompt: complete");
      await onProgress?.(
        `[LLM] runPrompt: Stream complete, total output=${accumulated.length} chars`,
      );

      return accumulated;
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
