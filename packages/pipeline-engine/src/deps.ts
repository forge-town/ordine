import type { ResultAsync } from "neverthrow";
import type { PublishArtifactOptions, RunPromptOptions, RunSkillOptions } from "./schemas";

export interface PipelineEngineDeps {
  runPrompt: (opts: RunPromptOptions) => ResultAsync<string, Error>;
  runSkill: (opts: RunSkillOptions) => ResultAsync<string, Error>;
  /**
   * Publish an artifact to a git repo or local directory; resolves with a result summary
   * (commit/PR/path). Optional so runtimes without publishing keep working — publish
   * operations fail with an explicit error when it is absent.
   */
  publishArtifact?: (opts: PublishArtifactOptions) => ResultAsync<string, Error>;
  structuredJsonToMarkdown: (content: string) => string;
  evaluateLoopCondition: (conditionPrompt: string, operationOutput: string) => Promise<boolean>;
}
