import { Result, ResultAsync } from "neverthrow";
import { extractJsonFromText } from "@repo/agent";
import { logger } from "@repo/logger";
import { runAgent, type AgentRunnerOptions } from "./agentRunner";

/**
 * 结构化 Agent 调用的通用 harness（H1-04）：进程级重试 → 提取 JSON → 解析，
 * 失败带 reason code。propose / generate / analyze / optimize 共用此函数，
 * 各自只负责 schema 校验与业务错误映射，不再各写一份"调 agent→提 JSON→重试"循环。
 */
export type StructuredAgentResult =
  | { ok: true; json: unknown }
  | { ok: false; code: "AGENT_FAILED" | "BAD_AGENT_OUTPUT"; detail: string };

export type RunStructuredAgentOptions = Pick<
  AgentRunnerOptions,
  "agent" | "systemPrompt" | "userPrompt" | "agentId" | "logPrefix" | "apiKey" | "model" | "ssh"
> & {
  /** 进程级重试次数（默认 3；analyzeIntent 等单次调用传 1）。 */
  maxRetries?: number;
  /** runAgent 需要的 cwd 来源，默认 process.cwd()。 */
  inputPath?: string;
  allowedTools?: readonly string[];
};

export const runStructuredAgent = async (
  opts: RunStructuredAgentOptions,
): Promise<StructuredAgentResult> => {
  const maxRetries = opts.maxRetries ?? 3;
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
    logger.error({ err: execution?.error }, `${logPrefix}: agent failed after retries`);

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
    logger.error({ raw }, `${logPrefix}: failed to extract JSON from agent response`);

    return { ok: false, code: "BAD_AGENT_OUTPUT", detail: "no JSON found in agent response" };
  }

  const parseJsonResult = Result.fromThrowable(
    JSON.parse,
    () => new Error("extracted text is not valid JSON"),
  )(extractJsonResult.value);
  if (parseJsonResult.isErr()) {
    logger.error(
      { json: extractJsonResult.value },
      `${logPrefix}: extracted text is not valid JSON`,
    );

    return { ok: false, code: "BAD_AGENT_OUTPUT", detail: "agent returned invalid JSON" };
  }

  return { ok: true, json: parseJsonResult.value };
};
