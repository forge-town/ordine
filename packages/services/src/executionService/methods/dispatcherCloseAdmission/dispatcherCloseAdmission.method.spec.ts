import { describe, expect, it } from "vitest";
import { createDispatcherCloseAdmissionMethod } from "./dispatcherCloseAdmission.method";
describe("dispatcherCloseAdmission", () => {
  it("closes admission on the shared dispatcher state", () => {
    const state = { accepting: true, started: false };
    createDispatcherCloseAdmissionMethod({ state })();
    expect(state.accepting).toBe(false);
  });
});
