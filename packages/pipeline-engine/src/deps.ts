import type { ResultAsync } from "neverthrow";
import type { RunPromptOptions, RunSkillOptions, RuleCheckOutput } from "./schemas";

export interface PipelineEngineDeps {
  runPrompt: (opts: RunPromptOptions) => ResultAsync<string, Error>;
  runSkill: (opts: RunSkillOptions) => ResultAsync<string, Error>;
  runRuleCheck: (inputPath: string) => Promise<RuleCheckOutput>;
  structuredJsonToMarkdown: (content: string) => string;
  listDirTree: (path: string, opts: { excludedPaths: string[] }) => Promise<string>;
  readProjectFiles: (
    path: string,
    opts: { excludedPaths: string[]; includedExtensions?: string[] },
  ) => Promise<string>;
  evaluateLoopCondition: (conditionPrompt: string, operationOutput: string) => Promise<boolean>;
}
