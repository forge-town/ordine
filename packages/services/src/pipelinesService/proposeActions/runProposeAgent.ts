import {
  runStructuredAgent,
  type StructuredAgentResult,
} from "../../pipelineRunnerService/agentRunner/runStructuredAgent";
import { withPipelineCanvasSkill } from "../pipelineCanvasSkillContext";
import { PROPOSE_AGENT_ID, PROPOSE_SYSTEM_PROMPT } from "./buildProposePrompt";

export const DEFAULT_PROPOSE_SYSTEM_PROMPT = withPipelineCanvasSkill(PROPOSE_SYSTEM_PROMPT);

export type RunProposeAgentOptions = {
  agent: Parameters<typeof runStructuredAgent>[0]["agent"];
  apiKey?: string;
  model?: string;
  signal?: AbortSignal;
  ssh?: Parameters<typeof runStructuredAgent>[0]["ssh"];
  userPrompt: string;
  /**
   * Override the default propose prompt — secondary flows such as
   * analyzeArtifacts reuse this executor.
   */
  agentId?: string;
  logPrefix?: string;
  systemPrompt?: string;
};

export type RunProposeAgentResult = StructuredAgentResult;

/**
 * Structured execution of the propose prompts: delegates to the shared
 * runStructuredAgent harness and only injects the propose-specific default
 * systemPrompt / agentId / logPrefix. Terminal failures come back as
 * code/detail — the caller owns the error log.
 */
export const runProposeAgent = (opts: RunProposeAgentOptions): Promise<RunProposeAgentResult> =>
  runStructuredAgent({
    agent: opts.agent,
    systemPrompt: opts.systemPrompt ?? DEFAULT_PROPOSE_SYSTEM_PROMPT,
    userPrompt: opts.userPrompt,
    agentId: opts.agentId ?? PROPOSE_AGENT_ID,
    logPrefix: opts.logPrefix ?? "proposeActions",
    apiKey: opts.apiKey,
    model: opts.model,
    signal: opts.signal,
    ssh: opts.ssh,
  });
