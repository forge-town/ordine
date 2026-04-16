/**
 * Prompt executor — sends a prompt + input to the configured agent backend.
 *
 * Dispatches to local-claude (CLI) or kimi (streaming LLM) based on
 * the `agent` field. Default: "local-claude".
 */

import { streamText } from "ai";
import { ResultAsync, errAsync } from "neverthrow";
import { getModel, runClaude, type SettingsResolver } from "@repo/agent";
import { logger } from "@repo/logger";
import type { AgentBackend } from "@repo/pipeline-engine";

export class PromptExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PromptExecutionError";
  }
}

export type StreamCallback = (accumulated: string) => Promise<void>;
export type ProgressCallback = (line: string) => Promise<void>;

export interface RunPromptOptions {
  prompt: string;
  inputContent: string;
  inputPath: string;
  getSettings: SettingsResolver;
  modelOverride?: string;
  agent?: AgentBackend;
  onChunk?: StreamCallback;
  onProgress?: ProgressCallback;
}

export const runPrompt = ({
  prompt,
  inputContent,
  getSettings,
  modelOverride,
  agent = "local-claude",
  onChunk,
  onProgress,
}: RunPromptOptions): ResultAsync<string, PromptExecutionError> => {
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

      if (agent === "local-claude") {
        const claudeResult = await runClaude({
          systemPrompt: prompt,
          userPrompt: inputContent,
          cwd: inputPath,
          allowedTools: [],
          onProgress,
        });
        logger.info({ outputLen: claudeResult.length }, "runPrompt: claude complete");
        await onProgress?.(`[LLM] runPrompt: Claude complete, output=${claudeResult.length} chars`);
        if (onChunk) await onChunk(claudeResult);
        return claudeResult;
      }

      // agent === "kimi" — use streaming LLM
      const model = await getModel(getSettings, modelOverride);
      if (!model) {
        logger.error("runPrompt: LLM not configured");
        await onProgress?.("[LLM] runPrompt: LLM not configured, throwing error");
        throw new PromptExecutionError("LLM not configured (API key missing in settings)");
      }
      logger.info("runPrompt: streaming (kimi)");
      await onProgress?.("[LLM] runPrompt: Starting streamText (kimi)...");
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
