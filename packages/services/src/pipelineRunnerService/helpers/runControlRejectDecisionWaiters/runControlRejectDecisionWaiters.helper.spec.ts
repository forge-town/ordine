import { describe, expect, it } from "vitest";
import { createRunControlRejectDecisionWaitersHelper } from "./runControlRejectDecisionWaiters.helper";
import { createRunControlGetStateHelper } from "../runControlGetState";
describe("runControlRejectDecisionWaiters", () => {
  it("rejects and clears pending decisions when their run is cancelled", async () => {
    const state = createRunControlGetStateHelper({ states: new Map() })("job-1");
    const completion = { reject(_cause: Error) {} };
    const pending = new Promise<void>((_resolve, reject) => {
      completion.reject = reject;
    });
    state.decisionWaiters.set("decision", { resolve: () => {}, reject: completion.reject });
    createRunControlRejectDecisionWaitersHelper({})(state, "job-1");
    await expect(pending).rejects.toThrow("Run job-1 was cancelled while waiting for a decision");
    expect(state.decisionWaiters.size).toBe(0);
  });
});
