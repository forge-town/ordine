import { promptExecutor } from "../promptExecutor";
import { skillExecutor } from "../skillExecutor";
import { structuredOutput } from "../structuredOutput";
import type { PipelineEngineDeps } from "@repo/pipeline-engine";
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
  }): PipelineEngineDeps => ({
    runPrompt: (o) => {
      const agent = o.agent ?? defaultAgent;

      return promptExecutor.run({
        ...o,
        agent,
        jobId,
        apiKey,
        model: o.model ?? (agent === defaultAgent ? model : undefined),
        ...(agent === defaultAgent && ssh ? { ssh } : {}),
        getMcpConnectorInjection,
      });
    },
    runSkill: (o) => {
      const agent = o.agent ?? defaultAgent;

      return skillExecutor.run({
        ...o,
        agent,
        jobId,
        apiKey,
        model: o.model ?? (agent === defaultAgent ? model : undefined),
        ...(agent === defaultAgent && ssh ? { ssh } : {}),
        getMcpConnectorInjection,
      });
    },
    structuredJsonToMarkdown: (content) => structuredOutput.toMarkdown({ content }),
    evaluateLoopCondition,
  }),
};
