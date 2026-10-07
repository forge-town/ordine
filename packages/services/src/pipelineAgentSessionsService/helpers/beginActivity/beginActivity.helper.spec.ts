import { describe, expect, it } from "vitest";
import { createBeginActivityHelper } from "./beginActivity.helper";

describe("beginActivity", () => {
  it("retains the planning and attachment boundary", () => {
    const activeActivities = new Map();
    const begin = createBeginActivityHelper({ activeActivities });
    const old = begin("session-1", "planning");
    const other = begin("session-2", "planning");
    const current = begin("session-1", "generating");
    expect(old.controller.signal.aborted).toBe(true);
    expect(other.controller.signal.aborted).toBe(false);
    expect(activeActivities.get("session-1")).toBe(current);
  });
});
