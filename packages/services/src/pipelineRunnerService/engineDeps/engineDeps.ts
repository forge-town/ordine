import { promptExecutor } from "../promptExecutor";
import { skillExecutor } from "../skillExecutor";
import { structuredOutput } from "../structuredOutput";
import type { PipelineEngineDeps } from "@repo/pipeline-engine";
import type { AgentRuntime } from "@repo/schemas";
import type { LoopEvaluatorFn } from "../loopEvaluator";

export const pipelineRunnerEngineDeps = {
  build: ({
    evaluateLoopCondition,
    jobId,
    apiKey,
    model,
    defaultAgent,
  }: {
    evaluateLoopCondition: LoopEvaluatorFn;
    jobId?: string;
    apiKey?: string;
    model?: string;
    defaultAgent?: AgentRuntime;
  }): PipelineEngineDeps => ({
    runPrompt: (o) =>
      promptExecutor.run({
        ...o,
        agent: o.agent ?? defaultAgent,
        jobId,
        apiKey,
        model,
      }),
    runSkill: (o) =>
      skillExecutor.run({
        ...o,
        agent: o.agent ?? defaultAgent,
        jobId,
        apiKey,
        model,
      }),
    structuredJsonToMarkdown: (content) => structuredOutput.toMarkdown({ content }),
    evaluateLoopCondition,
  }),
};
