import { DRIVERS } from "./drivers";
import { extractTokenTotals, recordObservability } from "./obs/observability";
import type { AgentRunOptions, AgentRunOutcome, AgentUsage } from "./types";

export type { AgentInputAttachment, AgentRunOptions, AgentRunOutcome, AgentUsage } from "./types";

const supportsImageAttachments = (agent: AgentRunOptions["agent"]) => agent === "mastra";

const rejectUnsupportedAttachments = (opts: AgentRunOptions) => {
  const hasImageAttachments = opts.attachments?.some((attachment) => attachment.kind === "image");
  if (hasImageAttachments && !supportsImageAttachments(opts.agent)) {
    throw new Error(`${opts.agent} runtime does not support image attachments`);
  }
};

/**
 * agentEngine: the runtime-agnostic execution entry point — dispatch + usage
 * accounting only. Driver adapters live in ./drivers; observability assembly
 * lives in ./obs/observability.
 */
const run = async (opts: AgentRunOptions): Promise<AgentRunOutcome> => {
  const driver = DRIVERS[opts.agent];
  if (!driver) {
    throw new Error(`Unsupported agent backend: "${opts.agent}"`);
  }
  rejectUnsupportedAttachments(opts);

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

  // Only claude returns an event stream usage can be derived from; every other
  // runtime honestly reports null ("usage unavailable") instead of a fake 0.
  const usage: AgentUsage | null =
    result.events.length > 0 ? extractTokenTotals(result.events) : null;

  return { text: result.text, usage };
};

export const agentEngine = { run };
