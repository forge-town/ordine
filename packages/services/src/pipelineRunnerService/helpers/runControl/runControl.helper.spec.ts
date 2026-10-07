import { describe, expect, it } from "vitest";

import { pipelineRunControl } from "./";

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
});
