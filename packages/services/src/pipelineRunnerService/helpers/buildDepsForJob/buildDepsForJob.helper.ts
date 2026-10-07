import type { AgentRuntime, SshConnection } from "@repo/schemas";
import { loopEvaluator } from "../loopEvaluator";
import { pipelineRunnerEngineDeps } from "../engineDeps";

import type { McpConnectorInjectionProvider } from "@repo/agent-engine";

import type { PipelineRunnerServiceBindings } from "../../contracts";
export const createBuildDepsForJobHelper =
  (serviceBindings: Pick<PipelineRunnerServiceBindings, "options">) =>
  ({
    jobId,
    apiKey,
    model,
    reasoningEffort,
    speed,
    firstOutputTimeoutMs,
    runtimeConfigId,
    executablePath,
    defaultAgent,
    overrideOperationRoute,
    ssh,
    getMcpConnectorInjection,
    signal,
  }: {
    jobId: string;
    apiKey?: string;
    model?: string;
    reasoningEffort?: string;
    speed?: string;
    firstOutputTimeoutMs?: number;
    runtimeConfigId?: string;
    executablePath?: string;
    defaultAgent?: AgentRuntime;
    overrideOperationRoute?: boolean;
    ssh?: SshConnection;
    getMcpConnectorInjection?: McpConnectorInjectionProvider;
    signal?: AbortSignal;
  }) => {
    const evaluateLoopCondition = loopEvaluator.create({ apiKey })({ jobId });

    return pipelineRunnerEngineDeps.build({
      evaluateLoopCondition,
      jobId,
      apiKey,
      model,
      reasoningEffort,
      speed,
      firstOutputTimeoutMs,
      runtimeConfigId,
      executablePath,
      defaultAgent,
      overrideOperationRoute,
      ssh,
      getMcpConnectorInjection,
      signal,
      agentRunController: serviceBindings.options.agentRunController,
    });
  };
