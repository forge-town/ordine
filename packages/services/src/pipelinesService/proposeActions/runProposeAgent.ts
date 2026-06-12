import { Result, ResultAsync } from "neverthrow";
import { extractJsonFromText } from "@repo/agent";
import { logger } from "@repo/logger";
import { runAgent } from "../../pipelineRunnerService/agentRunner/agentRunner";
import { PROPOSE_AGENT_ID, PROPOSE_SYSTEM_PROMPT } from "./buildProposePrompt";

const MAX_RETRIES = 3;

export type RunProposeAgentOptions = Pick<
  Parameters<typeof runAgent>[0],
  "agent" | "apiKey" | "model" | "ssh"
> & {
  userPrompt: string;
  /** 覆盖默认 propose 提示词——analyzeArtifacts 等第二用途复用该执行器（N14-02）。 */
  agentId?: string;
  logPrefix?: string;
  systemPrompt?: string;
};

export type RunProposeAgentResult =
  | { ok: true; json: unknown }
  | { ok: false; code: "AGENT_FAILED" | "BAD_AGENT_OUTPUT"; detail: string };

/**
 * Execute the propose prompt with process-level retries, then extract and
 * parse the JSON payload. Failures carry a reason code (manual N13-01).
 */
export const runProposeAgent = async (
  opts: RunProposeAgentOptions,
): Promise<RunProposeAgentResult> => {
  const execution = await (async () => {
    for (const attempt of Array.from({ length: MAX_RETRIES }, (_, i) => i + 1)) {
      const result = await ResultAsync.fromPromise(
        runAgent({
          agent: opts.agent,
          systemPrompt: opts.systemPrompt ?? PROPOSE_SYSTEM_PROMPT,
          userPrompt: opts.userPrompt,
          inputPath: process.cwd(),
          agentId: opts.agentId ?? PROPOSE_AGENT_ID,
          allowedTools: [],
          logPrefix: opts.logPrefix ?? "proposeActions",
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

    return {
      ok: false,
      code: "AGENT_FAILED",
      detail: execution?.isErr() ? execution.error.message : "agent did not run",
    };
  }

  const raw = execution.value;
  const extractJsonResult = Result.fromThrowable(
    extractJsonFromText,
    () => new Error("failed to extract JSON from agent response"),
  )(raw);
  if (extractJsonResult.isErr()) {
    logger.error({ raw }, "proposeActions: failed to extract JSON from agent response");

    return { ok: false, code: "BAD_AGENT_OUTPUT", detail: "no JSON found in agent response" };
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

    return { ok: false, code: "BAD_AGENT_OUTPUT", detail: "agent returned invalid JSON" };
  }

  return { ok: true, json: parseJsonResult.value };
};
