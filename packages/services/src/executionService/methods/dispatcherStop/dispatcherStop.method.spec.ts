import { describe, expect, it } from "vitest";
import { createDispatcherStopMethod } from "./dispatcherStop.method";
describe("dispatcherStop", () => {
  it("closes admission before shutdown", async () => {
    const state = { accepting: true, started: false };
    const result = await createDispatcherStopMethod({
      state,
      deps: { jobs: { listJobs: async () => [], requestControl: async () => {} } } as never,
      active: new Map(),
    } as never)(1);
    expect(state.accepting).toBe(false);
    expect(result.isOk()).toBe(true);
  });
});
