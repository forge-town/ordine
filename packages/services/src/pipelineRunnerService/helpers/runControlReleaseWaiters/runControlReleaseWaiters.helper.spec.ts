import { describe, expect, it } from "vitest";
import { createRunControlReleaseWaitersHelper } from "./runControlReleaseWaiters.helper";
describe("runControlReleaseWaiters", () => {
  it("retains the runner data and state boundary", () => {
    const state = { waiters: [] as Array<() => void> };
    const observations: number[] = [];
    state.waiters.push(() => observations.push(state.waiters.length));
    createRunControlReleaseWaitersHelper({})(state as never);
    expect(observations).toEqual([0]);
    expect(state.waiters).toEqual([]);
  });
});
