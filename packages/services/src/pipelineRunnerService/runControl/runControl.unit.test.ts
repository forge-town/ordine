import { describe, expect, it } from "vitest";
import { pipelineRunControl } from "./runControl";

describe("pipelineRunControl", () => {
  it("reports no pause for a fresh job", () => {
    const control = pipelineRunControl.buildForJob("job-fresh");

    expect(
      control.shouldPauseBeforeNode?.({ jobId: "job-fresh", nodeId: "n1", reason: "pause" }),
    ).toBe(false);

    pipelineRunControl.clear("job-fresh");
  });

  it("pause requests a node-boundary pause and resume releases the waiter", async () => {
    const jobId = "job-pause";
    const control = pipelineRunControl.buildForJob(jobId);

    pipelineRunControl.pause(jobId);
    expect(control.shouldPauseBeforeNode?.({ jobId, nodeId: "n1", reason: "pause" })).toBe(true);

    let resumed = false;
    const waiting = control.waitForResume?.({ jobId, nodeId: "n1", reason: "pause" }).then(() => {
      resumed = true;
    });

    expect(resumed).toBe(false);
    const result = pipelineRunControl.resume(jobId);
    await waiting;

    expect(resumed).toBe(true);
    expect(result).toEqual({ jobId, resumed: true });
    expect(control.shouldPauseBeforeNode?.({ jobId, nodeId: "n2", reason: "pause" })).toBe(false);

    pipelineRunControl.clear(jobId);
  });

  it("clear releases pending resume waiters (soft cancel never leaves the engine hanging)", async () => {
    const jobId = "job-cancel";
    const control = pipelineRunControl.buildForJob(jobId);

    pipelineRunControl.pause(jobId);
    let released = false;
    const waiting = control.waitForResume?.({ jobId, nodeId: "n1", reason: "pause" }).then(() => {
      released = true;
    });

    pipelineRunControl.clear(jobId);
    await waiting;

    expect(released).toBe(true);
  });

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
