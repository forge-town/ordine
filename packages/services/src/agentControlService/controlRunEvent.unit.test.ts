import { describe, expect, it } from "vitest";
import { canAppendControlRunEvent } from "./controlRunEvent";

describe("canAppendControlRunEvent", () => {
  it.each(["completed", "failed", "cancelled", "timed_out", "interrupted"] as const)(
    "rejects late events after a %s run",
    (status) => {
      expect(canAppendControlRunEvent({ controlMode: true, status })).toBe(false);
    },
  );

  it.each(["queued", "running", "cancelling"] as const)(
    "allows events while a control run is %s",
    (status) => {
      expect(canAppendControlRunEvent({ controlMode: true, status })).toBe(true);
    },
  );

  it("rejects missing and non-control runs", () => {
    expect(canAppendControlRunEvent(null)).toBe(false);
    expect(canAppendControlRunEvent({ controlMode: false, status: "running" })).toBe(false);
  });
});
