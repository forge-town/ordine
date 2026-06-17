import type { ResultAsync } from "neverthrow";
import type { PublishArtifactOptions, RunPromptOptions, RunSkillOptions } from "./schemas";

export interface PipelineEngineDeps {
  runPrompt: (opts: RunPromptOptions) => ResultAsync<string, Error>;
  runSkill: (opts: RunSkillOptions) => ResultAsync<string, Error>;
  /** 发布工件到 git 仓库 / 本地目录；返回结果摘要（commit/PR/路径）。 */
  publishArtifact: (opts: PublishArtifactOptions) => ResultAsync<string, Error>;
  structuredJsonToMarkdown: (content: string) => string;
  evaluateLoopCondition: (conditionPrompt: string, operationOutput: string) => Promise<boolean>;
}
