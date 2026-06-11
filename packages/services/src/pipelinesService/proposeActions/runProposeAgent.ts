import { Result, ResultAsync } from "neverthrow";
import { extractJsonFromText } from "@repo/agent";
import { logger } from "@repo/logger";
import { runAgent } from "../../pipelineRunnerService/agentRunner/agentRunner";
import { PROPOSE_AGENT_ID, PROPOSE_SYSTEM_PROMPT } from "./buildProposePrompt";

const MAX_RETRIES = 3;

export type RunProposeAgentOptions = Pick<
  Parameters<typeof runAgent>[0],
  "agent" | "apiKey" | "model" | "ssh"
> & { userPrompt: string };

/**
 * Execute the propose prompt with process-level retries, then extract and
 * parse the JSON payload. Returns `undefined` on any failure (logged).
 */
export const runProposeAgent = async (opts: RunProposeAgentOptions): Promise<unknown> => {
  const execution = await (async () => {
    for (const attempt of Array.from({ length: MAX_RETRIES }, (_, i) => i + 1)) {
      const result = await ResultAsync.fromPromise(
        runAgent({
          agent: opts.agent,
          systemPrompt: PROPOSE_SYSTEM_PROMPT,
          userPrompt: opts.userPrompt,
          inputPath: process.cwd(),
          agentId: PROPOSE_AGENT_ID,
          allowedTools: [],
          logPrefix: "proposeActions",
          apiKey: opts.apiKey,
          model: opts.model,
          ssh: opts.ssh,
        }),
        (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
      );
      if (result.isOk()) return result;
      if (attempt === MAX_RETRIES) return result;
      logger.warn(
        { attempt, err: result.error.message },
        "proposeActions: agent attempt failed, retrying",
      );
    }

    return undefined;
  })();

  if (!execution || execution.isErr()) {
    logger.error({ err: execution?.error }, "proposeActions: agent failed after retries");

    return undefined;
  }

  const raw = execution.value;
  const extractJsonResult = Result.fromThrowable(
    extractJsonFromText,
    () => new Error("failed to extract JSON from agent response"),
  )(raw);
  if (extractJsonResult.isErr()) {
    logger.error({ raw }, "proposeActions: failed to extract JSON from agent response");

    return undefined;
  }

  const parseJsonResult = Result.fromThrowable(
    JSON.parse,
    () => new Error("extracted text is not valid JSON"),
  )(extractJsonResult.value);
  if (parseJsonResult.isErr()) {
    logger.error(
      { json: extractJsonResult.value },
      "proposeActions: extracted text is not valid JSON",
    );

    return undefined;
  }

  return parseJsonResult.value;
};
