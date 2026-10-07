import { describe, expect, it } from "vitest";

import { pipelineRunControl } from "../../helpers/runControl";
describe("runControlClear", () => {
  it("retains the shared run-control boundary", () => {
    const old = pipelineRunControl.signal("clear-job");
    pipelineRunControl.cancel("clear-job");
    pipelineRunControl.clear("clear-job");
    const next = pipelineRunControl.signal("clear-job");
    expect(next).not.toBe(old);
    expect(next.aborted).toBe(false);
    pipelineRunControl.clear("clear-job");
  });
});
