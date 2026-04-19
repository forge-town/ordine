import { runPrompt as runPromptAgent } from "./promptExecutor";
import { runSkill as runSkillAgent } from "./skillExecutor";
import { structuredJsonToMarkdown } from "./structuredOutput";
import { listDirTree, readProjectFiles } from "@repo/utils";
import { runRuleCheck } from "./ruleCheckRunner";
import type { PipelineEngineDeps } from "@repo/pipeline-engine";
import type { RulesDaoInstance } from "@repo/models";
import type { SettingsResolver } from "@repo/agent";
import type { LoopEvaluatorFn } from "./loopEvaluator";

export const buildEngineDeps = (
  getSettings: SettingsResolver,
  rulesDao: RulesDaoInstance,
  evaluateLoopCondition: LoopEvaluatorFn,
  jobId?: string,
): PipelineEngineDeps => ({
  runPrompt: (o) =>
    runPromptAgent({
      ...o,
      getSettings,
    }),
  runSkill: (o) =>
    runSkillAgent({
      ...o,
      jobId,
      getSettings,
    }),
  runRuleCheck: (inputPath) => runRuleCheck(rulesDao, inputPath),
  structuredJsonToMarkdown,
  listDirTree,
  readProjectFiles,
  evaluateLoopCondition,
});
