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
    runPrompt: (o) =>
      promptExecutor.run({
        ...o,
        agent: o.agent ?? defaultAgent,
        jobId,
        apiKey,
        model: o.model ?? model,
        ssh,
        getMcpConnectorInjection,
      }),
    runSkill: (o) =>
      skillExecutor.run({
        ...o,
        agent: o.agent ?? defaultAgent,
        jobId,
        apiKey,
        model: o.model ?? model,
        ssh,
        getMcpConnectorInjection,
      }),
    structuredJsonToMarkdown: (content) => structuredOutput.toMarkdown({ content }),
    evaluateLoopCondition,
  }),
};
