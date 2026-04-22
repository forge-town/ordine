import { ResultAsync, errAsync } from "neverthrow";
import { agentEngine } from "@repo/agent-engine";
import { logger } from "@repo/logger";
import type { RunPromptOptions } from "@repo/pipeline-engine";
import { resolveCwd } from "../resolveCwd";

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
  agent = "claude-code",
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

      const cwd = resolveCwd({ inputPath });

      const engineResult = await ResultAsync.fromPromise(
        agentEngine.run({
          agent,
          mode: "direct",
          systemPrompt: prompt,
          userPrompt: inputContent,
          cwd,
          allowedTools: [],
          onProgress,
          jobId,
          agentId: PROMPT_AGENT_ID,
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
