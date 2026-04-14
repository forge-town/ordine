/**
 * Prompt executor — sends a prompt + input to an LLM via streaming.
 */

import { streamText } from "ai";
import { ResultAsync } from "neverthrow";
import {
  getLlmModel,
  type LlmOverride,
  type LogFn,
  type SettingsResolver,
  noopLog,
} from "@repo/agent";

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

export const runPrompt = (
  prompt: string,
  inputContent: string,
  getSettings: SettingsResolver,
  override?: LlmOverride,
  onChunk?: StreamCallback,
  log: LogFn = noopLog
): ResultAsync<string, PromptExecutionError> => {
  if (!prompt?.trim()) {
    return ResultAsync.fromSafePromise<string, PromptExecutionError>(
      Promise.reject(new PromptExecutionError("Prompt text is empty"))
    );
  }

  return ResultAsync.fromPromise(
    (async () => {
      await log(
        `[LLM] runPrompt: prompt length=${prompt.length}, input length=${inputContent.length}`
      );
      const model = await getLlmModel(getSettings, override, log);
      if (!model) {
        await log(`[LLM] runPrompt: LLM not configured, throwing error`);
        throw new PromptExecutionError("LLM not configured (API key missing in settings)");
      }
      await log(`[LLM] runPrompt: Starting streamText...`);
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
      await log(`[LLM] runPrompt: Stream complete, total output=${accumulated.length} chars`);
      return accumulated;
    })(),
    (cause) => {
      void log(
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
