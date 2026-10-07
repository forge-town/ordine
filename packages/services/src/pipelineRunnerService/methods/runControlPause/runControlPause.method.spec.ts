import { describe, expect, it } from "vitest";

import { pipelineRunControl } from "../../helpers/runControl";

describe("pipelineRunControl", () => {
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
});
