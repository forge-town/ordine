import { describe, expect, it } from "vitest";

import { pipelineRunControl } from "../../helpers/runControl";
describe("runControlSignal", () => {
  it("retains the shared run-control boundary", () => {
    const before = pipelineRunControl.signal("signal-job");
    expect(pipelineRunControl.signal("signal-job")).toBe(before);
    pipelineRunControl.cancel("signal-job");
    expect(before.aborted).toBe(true);
    pipelineRunControl.clear("signal-job");
  });
});
