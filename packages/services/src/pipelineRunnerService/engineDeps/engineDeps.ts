import { promptExecutor } from "../promptExecutor";
import { skillExecutor } from "../skillExecutor";
import { structuredOutput } from "../structuredOutput";
import { ruleCheckRunner } from "../ruleCheckRunner";
import type { PipelineEngineDeps } from "@repo/pipeline-engine";
import type { RulesDao } from "@repo/models";
import type { AgentRuntime } from "@repo/schemas";
import type { LoopEvaluatorFn } from "../loopEvaluator";

export const pipelineRunnerEngineDeps = {
  build: ({
    rulesDao,
    evaluateLoopCondition,
    jobId,
    apiKey,
    model,
    defaultAgent,
  }: {
    rulesDao: RulesDao;
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
    runRuleCheck: (inputPath) => ruleCheckRunner.run({ dao: rulesDao, inputPath }),
    structuredJsonToMarkdown: (content) => structuredOutput.toMarkdown({ content }),
    evaluateLoopCondition,
  }),
};
