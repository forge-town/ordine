import { promptExecutor } from "../promptExecutor";
import { skillExecutor } from "../skillExecutor";
import { structuredOutput } from "../structuredOutput";
import { ruleCheckRunner } from "../ruleCheckRunner";
import type { PipelineEngineDeps } from "@repo/pipeline-engine";
import type { RulesDao } from "@repo/models";
import type { LoopEvaluatorFn } from "../loopEvaluator";

export const pipelineRunnerEngineDeps = {
  build: ({
    rulesDao,
    evaluateLoopCondition,
    jobId,
  }: {
    rulesDao: RulesDao;
    evaluateLoopCondition: LoopEvaluatorFn;
    jobId?: string;
  }): PipelineEngineDeps => ({
    runPrompt: (o) =>
      promptExecutor.run({
        ...o,
        jobId,
      }),
    runSkill: (o) =>
      skillExecutor.run({
        ...o,
        jobId,
      }),
    runRuleCheck: (inputPath) => ruleCheckRunner.run({ dao: rulesDao, inputPath }),
    structuredJsonToMarkdown: (content) => structuredOutput.toMarkdown({ content }),
    evaluateLoopCondition,
  }),
};
