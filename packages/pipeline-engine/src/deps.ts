import type { ResultAsync } from "neverthrow";
import type { RunPromptOptions } from "./schemas/RunPromptOptions.js";
import type { RunSkillOptions } from "./schemas/RunSkillOptions.js";
import type { RuleCheckOutput } from "./schemas/RuleCheckOutput.js";

export interface PipelineEngineDeps {
  runPrompt: (opts: RunPromptOptions) => ResultAsync<string, Error>;
  runSkill: (opts: RunSkillOptions) => ResultAsync<string, never>;
  runRuleCheck: (inputPath: string) => Promise<RuleCheckOutput>;
  structuredJsonToMarkdown: (content: string) => string;
  listDirTree: (path: string, opts: { excludedPaths: string[] }) => Promise<string>;
  readProjectFiles: (
    path: string,
    opts: { excludedPaths: string[]; includedExtensions?: string[] },
  ) => Promise<string>;
  evaluateLoopCondition: (
    conditionPrompt: string,
    operationOutput: string,
    modelOverride?: string,
  ) => Promise<boolean>;
  log: (line: string) => Promise<void>;
}
