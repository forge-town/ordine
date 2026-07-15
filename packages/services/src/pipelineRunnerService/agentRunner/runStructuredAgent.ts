import { Result, ResultAsync } from "neverthrow";
import { extractJsonFromText } from "@repo/agent";
import { logger } from "@repo/logger";
import { runAgent, type AgentRunnerOptions } from "./agentRunner";

/**
 * Shared harness for structured agent calls: process-level retries, then JSON
 * extraction and parsing, with a reason code on failure. The propose / generate /
 * analyze / optimize flows all share this function, so each caller only handles
 * schema validation and business error mapping instead of repeating its own
 * "run agent → extract JSON → retry" loop. Terminal failures are reported via
 * the returned code/detail — the caller owns the one error log per failure;
 * the harness only warn-logs transient retry attempts.
 */
export type StructuredAgentResult =
  | { ok: true; json: unknown }
  | { ok: false; code: "AGENT_FAILED" | "BAD_AGENT_OUTPUT"; detail: string };

export type RunStructuredAgentOptions = Pick<
  AgentRunnerOptions,
  "agent" | "systemPrompt" | "userPrompt" | "agentId" | "logPrefix" | "apiKey" | "model" | "ssh"
> & {
  /** Process-level retry count (default 3; single-shot callers such as analyzeIntent pass 1). */
  maxRetries?: number;
  /** cwd handed to runAgent; defaults to process.cwd(). */
  inputPath?: string;
  allowedTools?: readonly string[];
};

const snippet = (text: string): string => (text.length <= 300 ? text : `${text.slice(0, 300)}…`);

export const runStructuredAgent = async (
  opts: RunStructuredAgentOptions,
): Promise<StructuredAgentResult> => {
  const maxRetries = Math.max(1, opts.maxRetries ?? 3);
  const logPrefix = opts.logPrefix;

  const execution = await (async () => {
    for (const attempt of Array.from({ length: maxRetries }, (_, i) => i + 1)) {
      const result = await ResultAsync.fromPromise(
        runAgent({
          agent: opts.agent,
          systemPrompt: opts.systemPrompt,
          userPrompt: opts.userPrompt,
          inputPath: opts.inputPath ?? process.cwd(),
          agentId: opts.agentId,
          allowedTools: opts.allowedTools ?? [],
          logPrefix,
          apiKey: opts.apiKey,
          model: opts.model,
          ssh: opts.ssh,
        }),
        (cause) => (cause instanceof Error ? cause : new Error(String(cause))),
      );
      if (result.isOk()) return result;
      if (attempt === maxRetries) return result;
      logger.warn(
        { attempt, err: result.error.message },
        `${logPrefix}: agent attempt failed, retrying`,
      );
    }

    return undefined;
  })();

  if (!execution || execution.isErr()) {
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
    return {
      ok: false,
      code: "BAD_AGENT_OUTPUT",
      detail: `no JSON found in agent response: ${snippet(raw)}`,
    };
  }

  const parseJsonResult = Result.fromThrowable(
    JSON.parse,
    () => new Error("extracted text is not valid JSON"),
  )(extractJsonResult.value);
  if (parseJsonResult.isErr()) {
    return {
      ok: false,
      code: "BAD_AGENT_OUTPUT",
      detail: `agent returned invalid JSON: ${snippet(extractJsonResult.value)}`,
    };
  }

  return { ok: true, json: parseJsonResult.value };
};
