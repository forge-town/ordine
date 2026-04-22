import { beforeEach, describe, expect, it, vi } from "vitest";
import { promptExecutor } from "../promptExecutor";
import { skillExecutor } from "../skillExecutor";
import { pipelineRunnerEngineDeps } from "./engineDeps";
import type { RulesDao } from "@repo/models";
import type { LoopEvaluatorFn } from "../loopEvaluator";

vi.mock("../promptExecutor", () => ({
  promptExecutor: {
    run: vi.fn(),
  },
}));

vi.mock("../skillExecutor", () => ({
  skillExecutor: {
    run: vi.fn(),
  },
}));

describe("pipelineRunnerEngineDeps", () => {
  // @ts-expect-error -- mock DAO with only required methods
  const rulesDao: RulesDao = {};
  const evaluateLoopCondition = vi.fn<LoopEvaluatorFn>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes jobId to promptExecutor", () => {
    const deps = pipelineRunnerEngineDeps.build({
      rulesDao,
      evaluateLoopCondition,
      jobId: "job-1",
    });

    deps.runPrompt({
      prompt: "analyze",
      inputContent: "content",
      inputPath: "/tmp/project",
    });

    expect(promptExecutor.run).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "analyze",
        inputContent: "content",
        inputPath: "/tmp/project",
        jobId: "job-1",
      }),
    );
  });

  it("passes jobId to skillExecutor", () => {
    const deps = pipelineRunnerEngineDeps.build({
      rulesDao,
      evaluateLoopCondition,
      jobId: "job-1",
    });

    deps.runSkill({
      skillId: "skill-1",
      skillDescription: "desc",
      inputContent: "content",
      inputPath: "/tmp/project",
    });

    expect(skillExecutor.run).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: "skill-1",
        skillDescription: "desc",
        inputContent: "content",
        inputPath: "/tmp/project",
        jobId: "job-1",
      }),
    );
  });
});
