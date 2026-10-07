import { describe, expect, it } from "vitest";
import { createCloseAdmissionMethod } from "./closeAdmission.method";

describe("closeAdmission", () => {
  it("preserves the public Agent Run result and lifecycle boundary", async () => {
    const controller = new AbortController();
    controller.abort();
    const active = { controller, abortReason: "inactivity_timeout" };
    const admission = { open: true };
    createCloseAdmissionMethod({ admission, activeRuns: new Map([["run-1", active]]) } as never)();
    expect(admission.open).toBe(false);
    expect(active.abortReason).toBe("inactivity_timeout");
  });
});
