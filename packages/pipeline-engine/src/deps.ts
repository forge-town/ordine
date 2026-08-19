import type { ResultAsync } from "neverthrow";
import type { LoopEvaluationOptions, RunPromptOptions, RunSkillOptions } from "./schemas";

export interface PipelineEngineDeps {
  runPrompt: (opts: RunPromptOptions) => ResultAsync<string, Error>;
  runSkill: (opts: RunSkillOptions) => ResultAsync<string, Error>;
  structuredJsonToMarkdown: (content: string) => string;
  evaluateLoopCondition: (opts: LoopEvaluationOptions) => Promise<boolean>;
}
