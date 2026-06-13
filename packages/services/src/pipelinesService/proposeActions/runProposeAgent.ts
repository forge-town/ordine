import {
  runStructuredAgent,
  type StructuredAgentResult,
} from "../../pipelineRunnerService/agentRunner/runStructuredAgent";
import { PROPOSE_AGENT_ID, PROPOSE_SYSTEM_PROMPT } from "./buildProposePrompt";

export type RunProposeAgentOptions = {
  agent: Parameters<typeof runStructuredAgent>[0]["agent"];
  apiKey?: string;
  model?: string;
  ssh?: Parameters<typeof runStructuredAgent>[0]["ssh"];
  userPrompt: string;
  /** 覆盖默认 propose 提示词——analyzeArtifacts 等第二用途复用该执行器（N14-02）。 */
  agentId?: string;
  logPrefix?: string;
  systemPrompt?: string;
};

export type RunProposeAgentResult = StructuredAgentResult;

/**
 * propose 提示词的结构化执行：现委托给通用 runStructuredAgent（H1-04），
 * 仅注入 propose 专属的默认 systemPrompt / agentId / logPrefix。
 */
export const runProposeAgent = (opts: RunProposeAgentOptions): Promise<RunProposeAgentResult> =>
  runStructuredAgent({
    agent: opts.agent,
    systemPrompt: opts.systemPrompt ?? PROPOSE_SYSTEM_PROMPT,
    userPrompt: opts.userPrompt,
    agentId: opts.agentId ?? PROPOSE_AGENT_ID,
    logPrefix: opts.logPrefix ?? "proposeActions",
    apiKey: opts.apiKey,
    model: opts.model,
    ssh: opts.ssh,
  });
