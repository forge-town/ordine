import { ResultAsync, errAsync } from "neverthrow";
import { logger } from "@repo/logger";
import type { RunPromptOptions } from "@repo/pipeline-engine";
import type { SshConnection } from "@repo/schemas";
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

type PromptExecutorOptions = RunPromptOptions & { ssh?: SshConnection };

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
  extraTools,
  githubToken,
  ssh,
}: PromptExecutorOptions): ResultAsync<string, PromptExecutionError> => {
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
        allowedTools: extraTools ?? [],
        onProgress,
        logPrefix: "[LLM] runPrompt",
        apiKey,
        model,
        githubToken,
        ssh,
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
