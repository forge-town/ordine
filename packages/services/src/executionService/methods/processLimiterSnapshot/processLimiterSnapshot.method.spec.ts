import { describe, expect, it } from "vitest";
import { createProcessLimiterSnapshotMethod } from "./processLimiterSnapshot.method";
describe("processLimiterSnapshot", () => {
  it("returns live queue and runtime counts", () => {
    const state = { active: 2 };
    const queue = [{}, {}] as never;
    const counts = new Map([["codex", 2]]);
    expect(createProcessLimiterSnapshotMethod({ state, queue, counts })()).toEqual({
      active: 2,
      queued: 2,
      runtimes: { codex: 2 },
    });
  });
});
