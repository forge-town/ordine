import { describe, expect, it } from "vitest";

import { pipelineRunControl } from "../../helpers/runControl";

describe("pipelineRunControl", () => {
  it("resolveDecision wakes the suspended decision node with the selected candidates", async () => {
    const jobId = "job-decision";
    const control = pipelineRunControl.buildForJob(jobId);

    const pending = control.waitForDecision?.({
      jobId,
      nodeId: "decision-1",
      selectMode: "single",
      candidates: [],
    });

    const result = pipelineRunControl.resolveDecision(jobId, "decision-1", ["edge-a"]);
    expect(result).toEqual({ jobId, nodeId: "decision-1", resolved: true });

    await expect(pending).resolves.toEqual({ selectedCandidateIds: ["edge-a"] });

    pipelineRunControl.clear(jobId);
  });

  it("resolveDecision reports resolved=false when no decision is pending", () => {
    const result = pipelineRunControl.resolveDecision("job-none", "node-x", ["edge-a"]);

    expect(result.resolved).toBe(false);

    pipelineRunControl.clear("job-none");
  });
});
