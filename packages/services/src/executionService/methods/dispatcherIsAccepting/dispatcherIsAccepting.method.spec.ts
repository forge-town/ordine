import { describe, expect, it } from "vitest";
import { createDispatcherIsAcceptingMethod } from "./dispatcherIsAccepting.method";
describe("dispatcherIsAccepting", () => {
  it("reflects admission state", () => {
    const state = { accepting: false, started: false };
    const method = createDispatcherIsAcceptingMethod({ state });
    expect(method()).toBe(false);
    state.accepting = true;
    expect(method()).toBe(true);
  });
});
