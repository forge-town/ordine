import { promptExecutor } from "../promptExecutor";
import { skillExecutor } from "../skillExecutor";
import { structuredOutput } from "../structuredOutput";
import type { PipelineEngineDeps } from "@repo/pipeline-engine";
import type { AgentRuntime, SshConnection } from "@repo/schemas";
import type { ClaudeMcpInjectionProvider } from "../agentRunner/agentRunner";
import type { LoopEvaluatorFn } from "../loopEvaluator";

export const pipelineRunnerEngineDeps = {
  build: ({
    evaluateLoopCondition,
    jobId,
    apiKey,
    model,
    defaultAgent,
    ssh,
    getClaudeMcpInjection,
  }: {
    evaluateLoopCondition: LoopEvaluatorFn;
    jobId?: string;
    apiKey?: string;
    model?: string;
    defaultAgent?: AgentRuntime;
    ssh?: SshConnection;
    getClaudeMcpInjection?: ClaudeMcpInjectionProvider;
  }): PipelineEngineDeps => ({
    runPrompt: (o) =>
      promptExecutor.run({
        ...o,
        agent: o.agent ?? defaultAgent,
        jobId,
        apiKey,
        model,
        ssh,
        getClaudeMcpInjection,
      }),
    runSkill: (o) =>
      skillExecutor.run({
        ...o,
        agent: o.agent ?? defaultAgent,
        jobId,
        apiKey,
        model,
        ssh,
        getClaudeMcpInjection,
      }),
    structuredJsonToMarkdown: (content) => structuredOutput.toMarkdown({ content }),
    evaluateLoopCondition,
  }),
};
