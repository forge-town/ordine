import { describe, expect, it } from "vitest";
import { createFinishActivityHelper } from "./finishActivity.helper";

describe("finishActivity", () => {
  it("retains the planning and attachment boundary", () => {
    const stale = { kind: "planning" as const, controller: new AbortController() };
    const current = { kind: "generating" as const, controller: new AbortController() };
    const activeActivities = new Map([["session", current]]);
    const finish = createFinishActivityHelper({ activeActivities });
    finish("session", stale);
    expect(activeActivities.get("session")).toBe(current);
    finish("session", current);
    expect(activeActivities.has("session")).toBe(false);
  });
});
