import { DRIVERS } from "./drivers";
import { extractTokenTotals, recordObservability } from "./obs/observability";
import type { AgentRunOptions, AgentRunOutcome, AgentUsage } from "./types";

export type {
  AgentInputAttachment,
  AgentRunOptions,
  AgentRunOutcome,
  AgentUsage,
  McpConnectorInjectionProvider,
} from "./types";

const supportsImageAttachments = (agent: AgentRunOptions["agent"]) =>
  agent === "mastra" || agent === "pi-agent";

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
const runDirect = async (opts: AgentRunOptions): Promise<AgentRunOutcome> => {
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

  // Usage is derived only from a claude result event that actually carries
  // modelUsage; when it is absent (non-claude runtimes, or claude without usage)
  // extractTokenTotals returns null — an honest "unavailable", never a fake 0.
  const usage: AgentUsage | null = extractTokenTotals(result.events);

  return { text: result.text, usage };
};

export type AgentRunController = (opts: AgentRunOptions) => Promise<AgentRunOutcome>;

const controllerState = { current: null as AgentRunController | null };

const run = (opts: AgentRunOptions): Promise<AgentRunOutcome> =>
  controllerState.current ? controllerState.current(opts) : runDirect(opts);

const setRunController = (controller: AgentRunController | null): void => {
  controllerState.current = controller;
};

export const agentEngine = { run, runDirect, setRunController };
