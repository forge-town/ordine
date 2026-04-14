/**
 * Prompt executor — sends a prompt + input to an LLM via streaming.
 */

import { streamText } from "ai";
import { ResultAsync } from "neverthrow";
import { getLlmModel, logger, type LlmOverride, type SettingsResolver } from "@repo/agent";

export class PromptExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "PromptExecutionError";
  }
}

export type StreamCallback = (accumulated: string) => Promise<void>;
export type ProgressCallback = (line: string) => Promise<void>;

export const runPrompt = (
  prompt: string,
  inputContent: string,
  getSettings: SettingsResolver,
  override?: LlmOverride,
  onChunk?: StreamCallback,
  onProgress?: ProgressCallback
): ResultAsync<string, PromptExecutionError> => {
  if (!prompt?.trim()) {
    return ResultAsync.fromSafePromise<string, PromptExecutionError>(
      Promise.reject(new PromptExecutionError("Prompt text is empty"))
    );
  }

  return ResultAsync.fromPromise(
    (async () => {
      logger.info(
        { promptLen: prompt.length, inputLen: inputContent.length },
        "runPrompt: starting"
      );
      await onProgress?.(
        `[LLM] runPrompt: prompt length=${prompt.length}, input length=${inputContent.length}`
      );
      const model = await getLlmModel(getSettings, override);
      if (!model) {
        logger.error("runPrompt: LLM not configured");
        await onProgress?.("[LLM] runPrompt: LLM not configured, throwing error");
        throw new PromptExecutionError("LLM not configured (API key missing in settings)");
      }
      logger.info("runPrompt: streaming");
      await onProgress?.("[LLM] runPrompt: Starting streamText...");
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
        `[LLM] runPrompt: Stream complete, total output=${accumulated.length} chars`
      );
      return accumulated;
    })(),
    (cause) => {
      logger.error({ err: cause }, "runPrompt: failed");
      void onProgress?.(
        `[LLM] runPrompt: Error — ${cause instanceof Error ? cause.message : String(cause)}`
      );
      return cause instanceof PromptExecutionError
        ? cause
        : new PromptExecutionError(
            `Prompt execution failed: ${cause instanceof Error ? cause.message : String(cause)}`,
            cause
          );
    }
  );
};
