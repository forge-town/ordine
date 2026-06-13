import { DRIVERS } from "./drivers";
import { extractTokenTotals, recordObservability } from "./obs/observability";
import type { AgentRunOptions, AgentRunOutcome, AgentUsage } from "./types";

export type { AgentRunOptions, AgentRunOutcome, AgentUsage } from "./types";

/**
 * agentEngine：runtime 无关的统一执行入口（H1-05 瘦身后只留调度 + 用量折算）。
 * driver 适配在 ./drivers，可观测性拼装在 ./obs/observability。
 */
const run = async (opts: AgentRunOptions): Promise<AgentRunOutcome> => {
  const driver = DRIVERS[opts.agent];
  if (!driver) {
    throw new Error(`Unsupported agent backend: "${opts.agent}"`);
  }

  const startTime = Date.now();
  const result = await driver(opts);

  if (opts.jobId && opts.agentId) {
    await recordObservability({
      jobId: opts.jobId,
      agentId: opts.agentId,
      agent: opts.agent,
      systemPrompt: opts.systemPrompt,
      userPrompt: opts.userPrompt,
      result,
      startTime,
    });
  }

  // 仅 claude 带回事件流可折算用量；其余 runtime 诚实返回 null（"用量不可用"）。
  const usage: AgentUsage | null =
    result.events.length > 0 ? extractTokenTotals(result.events) : null;

  return { text: result.text, usage };
};

export const agentEngine = { run };
