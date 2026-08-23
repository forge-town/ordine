import { promptExecutor } from "../promptExecutor";
import { skillExecutor } from "../skillExecutor";
import { structuredOutput } from "../structuredOutput";
import type { LoopEvaluationOptions, PipelineEngineDeps } from "@repo/pipeline-engine";
import type { AgentRuntime, SshConnection } from "@repo/schemas";
import type { McpConnectorInjectionProvider } from "../agentRunner/agentRunner";
import type { LoopEvaluatorFn } from "../loopEvaluator";

export const pipelineRunnerEngineDeps = {
  build: ({
    evaluateLoopCondition,
    jobId,
    apiKey,
    model,
    reasoningEffort,
    speed,
    runtimeConfigId,
    executablePath,
    defaultAgent,
    overrideOperationRoute,
    ssh,
    getMcpConnectorInjection,
  }: {
    evaluateLoopCondition: LoopEvaluatorFn;
    jobId?: string;
    apiKey?: string;
    model?: string;
    reasoningEffort?: string;
    speed?: string;
    runtimeConfigId?: string;
    executablePath?: string;
    defaultAgent?: AgentRuntime;
    overrideOperationRoute?: boolean;
    ssh?: SshConnection;
    getMcpConnectorInjection?: McpConnectorInjectionProvider;
  }): PipelineEngineDeps => {
    const resolveRoute = (route: Pick<LoopEvaluationOptions, "agent" | "model">) => {
      const agent = overrideOperationRoute ? defaultAgent : (route.agent ?? defaultAgent);
      const usesDefaultRoute = overrideOperationRoute || agent === defaultAgent;

      return {
        agent,
        model: overrideOperationRoute
          ? model
          : (route.model ?? (usesDefaultRoute ? model : undefined)),
        ...(usesDefaultRoute && reasoningEffort ? { reasoningEffort } : {}),
        ...(usesDefaultRoute && speed ? { speed } : {}),
        ...(usesDefaultRoute && runtimeConfigId ? { runtimeConfigId } : {}),
        ...(usesDefaultRoute && executablePath ? { executablePath } : {}),
        ...(usesDefaultRoute && ssh ? { ssh } : {}),
      };
    };

    return {
      runPrompt: (o) =>
        promptExecutor.run({
          ...o,
          ...resolveRoute(o),
          jobId,
          apiKey,
          getMcpConnectorInjection,
        }),
      runSkill: (o) =>
        skillExecutor.run({
          ...o,
          ...resolveRoute(o),
          jobId,
          apiKey,
          getMcpConnectorInjection,
        }),
      structuredJsonToMarkdown: (content) => structuredOutput.toMarkdown({ content }),
      evaluateLoopCondition: (o) => evaluateLoopCondition({ ...o, ...resolveRoute(o) }),
    };
  },
};
