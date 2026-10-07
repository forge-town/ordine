import { describe, expect, it } from "vitest";

import { pipelineRunControl } from "../../helpers/runControl";

describe("pipelineRunControl", () => {
  it("cancel while running raises the boundary cancel flag without clearing state", async () => {
    const jobId = "job-cancel-running";
    const control = pipelineRunControl.buildForJob(jobId);
    const signal = pipelineRunControl.signal(jobId);

    const result = pipelineRunControl.cancel(jobId);

    expect(result).toEqual({ jobId, cancelled: true });
    expect(signal.aborted).toBe(true);
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
});
