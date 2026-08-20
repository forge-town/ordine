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
    defaultAgent,
    ssh,
    getMcpConnectorInjection,
  }: {
    evaluateLoopCondition: LoopEvaluatorFn;
    jobId?: string;
    apiKey?: string;
    model?: string;
    defaultAgent?: AgentRuntime;
    ssh?: SshConnection;
    getMcpConnectorInjection?: McpConnectorInjectionProvider;
  }): PipelineEngineDeps => {
    const resolveRoute = (route: Pick<LoopEvaluationOptions, "agent" | "model">) => {
      const agent = route.agent ?? defaultAgent;

      return {
        agent,
        model: route.model ?? (agent === defaultAgent ? model : undefined),
        ...(agent === defaultAgent && ssh ? { ssh } : {}),
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
