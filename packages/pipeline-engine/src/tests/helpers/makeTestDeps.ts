import { okAsync, errAsync } from "neverthrow";
import { vi } from "vitest";
import type { PipelineEngineDeps } from "../../deps";

export const makeTestDeps = (overrides: Partial<PipelineEngineDeps> = {}): PipelineEngineDeps => ({
  runPrompt: vi.fn().mockReturnValue(okAsync("prompt-output")),
  runSkill: vi.fn().mockReturnValue(okAsync("skill-output")),
  structuredJsonToMarkdown: vi.fn((content: string) => `# Markdown\n${content}`),
  evaluateLoopCondition: vi.fn().mockResolvedValue(true),
  ...overrides,
});

export const makePromptFailureDeps = (): PipelineEngineDeps =>
  makeTestDeps({
    runPrompt: vi.fn().mockReturnValue(errAsync(new Error("prompt failed"))),
  });
