import { promptExecutor } from "../promptExecutor";
import { skillExecutor } from "../skillExecutor";
import { structuredOutput } from "../structuredOutput";
import { listDirTree, readProjectFiles } from "@repo/utils";
import { ruleCheckRunner } from "../ruleCheckRunner";
import type { PipelineEngineDeps } from "@repo/pipeline-engine";
import type { RulesDaoInstance } from "@repo/models";
import type { SettingsResolver } from "@repo/agent";
import type { LoopEvaluatorFn } from "../loopEvaluator";

const build = ({
  getSettings,
  rulesDao,
  evaluateLoopCondition,
  jobId,
}: {
  getSettings: SettingsResolver;
  rulesDao: RulesDaoInstance;
  evaluateLoopCondition: LoopEvaluatorFn;
  jobId?: string;
}): PipelineEngineDeps => ({
  runPrompt: (o) =>
    promptExecutor.run({
      ...o,
      getSettings,
    }),
  runSkill: (o) =>
    skillExecutor.run({
      ...o,
      jobId,
      getSettings,
    }),
  runRuleCheck: (inputPath) => ruleCheckRunner.run({ dao: rulesDao, inputPath }),
  structuredJsonToMarkdown: (content) => structuredOutput.toMarkdown({ content }),
  listDirTree,
  readProjectFiles,
  evaluateLoopCondition,
});

export const pipelineRunnerEngineDeps = {
  build,
};
