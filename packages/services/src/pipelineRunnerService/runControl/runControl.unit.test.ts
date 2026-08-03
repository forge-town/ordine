import { describe, expect, it } from "vitest";
import { pipelineRunControl } from "./runControl";

describe("pipelineRunControl", () => {
  it("reports no pause and no cancel for a fresh job", () => {
    const control = pipelineRunControl.buildForJob("job-fresh");

    expect(
      control.shouldPauseBeforeNode?.({ jobId: "job-fresh", nodeId: "n1", reason: "pause" }),
    ).toBe(false);
    expect(
      control.shouldCancelBeforeNode?.({ jobId: "job-fresh", nodeId: "n1", reason: "pause" }),
    ).toBe(false);

    pipelineRunControl.clear("job-fresh");
  });

  it("pause requests a node-boundary pause and resume releases the waiter", async () => {
    const jobId = "job-pause";
    const control = pipelineRunControl.buildForJob(jobId);

    pipelineRunControl.pause(jobId);
    expect(control.shouldPauseBeforeNode?.({ jobId, nodeId: "n1", reason: "pause" })).toBe(true);

    const resumed = { value: false };
    const waiting = control.waitForResume?.({ jobId, nodeId: "n1", reason: "pause" }).then(() => {
      resumed.value = true;
    });

    expect(resumed.value).toBe(false);
    const result = pipelineRunControl.resume(jobId);
    await waiting;

    expect(resumed.value).toBe(true);
    expect(result).toEqual({ jobId, resumed: true });
    expect(control.shouldPauseBeforeNode?.({ jobId, nodeId: "n2", reason: "pause" })).toBe(false);

    pipelineRunControl.clear(jobId);
  });

  it("resolves waitForResume immediately when resume landed before the engine parked (lost-resume race)", async () => {
    const jobId = "job-race";
    const control = pipelineRunControl.buildForJob(jobId);

    pipelineRunControl.pause(jobId);
    pipelineRunControl.resume(jobId);

    // The engine saw shouldPauseBeforeNode === true before the resume landed,
    // and only reaches waitForResume now — it must not park forever.
    await expect(
      control.waitForResume?.({ jobId, nodeId: "n1", reason: "pause" }),
    ).resolves.toBeUndefined();

    pipelineRunControl.clear(jobId);
  });

  it("cancel while running raises the boundary cancel flag without clearing state", async () => {
    const jobId = "job-cancel-running";
    const control = pipelineRunControl.buildForJob(jobId);

    const result = pipelineRunControl.cancel(jobId);

    expect(result).toEqual({ jobId, cancelled: true });
    // The engine sees the cancel flag at the next node boundary and stops.
    expect(control.shouldCancelBeforeNode?.({ jobId, nodeId: "n2", reason: "pause" })).toBe(true);
    // A late waitForResume never parks on a cancelled run.
    await expect(
      control.waitForResume?.({ jobId, nodeId: "n2", reason: "pause" }),
    ).resolves.toBeUndefined();

    pipelineRunControl.clear(jobId);
  });

  it("cancel while paused wakes the waiter and keeps the cancel flag set (no silent continue)", async () => {
    const jobId = "job-cancel-paused";
    const control = pipelineRunControl.buildForJob(jobId);

    pipelineRunControl.pause(jobId);
    const woken = { value: false };
    const waiting = control.waitForResume?.({ jobId, nodeId: "n1", reason: "pause" }).then(() => {
      woken.value = true;
    });

    pipelineRunControl.cancel(jobId);
    await waiting;

    expect(woken.value).toBe(true);
    // After waking, the engine re-checks the cancel flag and must stop.
    expect(control.shouldCancelBeforeNode?.({ jobId, nodeId: "n1", reason: "pause" })).toBe(true);

    pipelineRunControl.clear(jobId);
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

  it("cancel rejects a pending decision waiter so the run can settle", async () => {
    const jobId = "job-cancel-decision";
    const control = pipelineRunControl.buildForJob(jobId);

    const pending = control.waitForDecision?.({
      jobId,
      nodeId: "decision-1",
      selectMode: "single",
      candidates: [],
    });

    pipelineRunControl.cancel(jobId);

    await expect(pending).rejects.toThrow(/cancelled while waiting for a decision/);

    pipelineRunControl.clear(jobId);
  });

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

  it("does not create a ghost entry when cancelling a job with no live run", () => {
    const result = pipelineRunControl.cancel("job-ghost");

    expect(result).toEqual({ jobId: "job-ghost", cancelled: true });
    // A later live run for the same id must start with a clean state — the
    // DB-only cancel above must not have left a dangling cancel flag.
    const control = pipelineRunControl.buildForJob("job-ghost");
    expect(
      control.shouldCancelBeforeNode?.({ jobId: "job-ghost", nodeId: "n1", reason: "pause" }),
    ).toBe(false);

    pipelineRunControl.clear("job-ghost");
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

  it("resolveDecision reports resolved=false when no decision is pending", () => {
    const result = pipelineRunControl.resolveDecision("job-none", "node-x", ["edge-a"]);

    expect(result.resolved).toBe(false);

    pipelineRunControl.clear("job-none");
  });
});
