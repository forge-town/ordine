import { ResultAsync, errAsync } from "neverthrow";
import { logger } from "@repo/logger";
import type { RunPromptOptions } from "@repo/pipeline-engine";
import { runAgent } from "../agentRunner/agentRunner";

export class PromptExecutionError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "PromptExecutionError";
  }
}

const PROMPT_AGENT_ID = "prompt-executor";

const run = ({
  prompt,
  inputContent,
  inputPath,
  jobId,
  agent = "mastra",
  onChunk,
  onProgress,
  apiKey,
  model,
}: RunPromptOptions): ResultAsync<string, PromptExecutionError> => {
  if (!prompt?.trim()) {
    return errAsync(new PromptExecutionError("Prompt text is empty"));
  }

  return ResultAsync.fromPromise(
    (async () => {
      const raw = await runAgent({
        agent,
        systemPrompt: prompt,
        userPrompt: inputContent,
        inputPath,
        jobId,
        agentId: PROMPT_AGENT_ID,
        allowedTools: [],
        onProgress,
        logPrefix: "[LLM] runPrompt",
        apiKey,
        model,
      });
      if (onChunk) await onChunk(raw);

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
