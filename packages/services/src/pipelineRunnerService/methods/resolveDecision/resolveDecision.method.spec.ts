import { describe, expect, it } from "vitest";
import { createResolveDecisionMethod } from "./resolveDecision.method";
import { pipelineRunControl } from "../../helpers/runControl";
describe("resolveDecision", () => {
  it("retains the shared run-control boundary", () => {
    const resolve = createResolveDecisionMethod({});
    const result = resolve("no-decision", "node", []);
    expect(result._unsafeUnwrap()).toEqual({
      jobId: "no-decision",
      nodeId: "node",
      resolved: false,
    });
    pipelineRunControl.clear("no-decision");
  });
});
