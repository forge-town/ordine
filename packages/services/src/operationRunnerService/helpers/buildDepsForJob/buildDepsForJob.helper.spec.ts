import { describe, expect, it, vi } from "vitest";
const runPrompt = vi.fn().mockResolvedValue({ content: "executed prompt" });
vi.mock("../../../pipelineRunnerService/helpers/promptExecutor", () => ({
  promptExecutor: { run: (...args: unknown[]) => runPrompt(...args) },
}));
import { createBuildDepsForJobHelper } from "./buildDepsForJob.helper";
describe("buildDepsForJob", () => {
  it("retains the job context and selected default runtime when engine prompts execute", async () => {
    const deps = createBuildDepsForJobHelper()({
      jobId: "job-1",
      model: "selected-model",
      defaultAgent: "mastra",
    });
    await deps.runPrompt({ prompt: "Summarize evidence" } as never);
    expect(runPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Summarize evidence",
        jobId: "job-1",
        agent: "mastra",
        model: "selected-model",
      }),
    );
  });
});
