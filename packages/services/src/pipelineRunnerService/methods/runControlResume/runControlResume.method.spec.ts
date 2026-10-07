import { describe, expect, it } from "vitest";

import { pipelineRunControl } from "../../helpers/runControl";

describe("pipelineRunControl", () => {
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
});
