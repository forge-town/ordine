import { describe, expect, it } from "vitest";

import { pipelineRunControl } from "../../helpers/runControl";

describe("pipelineRunControl", () => {
  it("rejects waitForDecision immediately when cancellation is already requested", async () => {
    const jobId = "job-cancel-then-decision";
    const control = pipelineRunControl.buildForJob(jobId);

    pipelineRunControl.cancel(jobId);

    await expect(
      control.waitForDecision?.({
        jobId,
        nodeId: "decision-1",
        selectMode: "single",
        candidates: [],
      }),
    ).rejects.toThrow(/cancelled while waiting for a decision/);

    pipelineRunControl.clear(jobId);
  });

  it("flags a run registered by buildForJob even before its first boundary check", () => {
    // startRun registers the state eagerly via buildForJob...
    const control = pipelineRunControl.buildForJob("job-early");
    // ...so a cancel landing before the engine's first boundary check sticks.
    pipelineRunControl.cancel("job-early");

    expect(
      control.shouldCancelBeforeNode?.({ jobId: "job-early", nodeId: "n1", reason: "pause" }),
    ).toBe(true);

    pipelineRunControl.clear("job-early");
  });
});
