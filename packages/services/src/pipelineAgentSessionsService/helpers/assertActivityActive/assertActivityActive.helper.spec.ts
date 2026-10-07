import { describe, expect, it } from "vitest";
import { createAssertActivityActiveHelper } from "./assertActivityActive.helper";

describe("assertActivityActive", () => {
  it("retains the planning and attachment boundary", () => {
    const activity = { kind: "planning" as const, controller: new AbortController() };
    const guard = createAssertActivityActiveHelper({ activeActivities: new Map() });
    expect(() => guard("session", activity)).toThrow("session cancelled");
  });
});
