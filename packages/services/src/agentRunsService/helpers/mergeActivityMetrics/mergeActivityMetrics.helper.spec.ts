import { describe, expect, it } from "vitest";
import { mergeActivityMetrics } from "./mergeActivityMetrics.helper";

describe("mergeActivityMetrics", () => {
  it("retains the Agent Run boundary contract", () => {
    const original = { eventCount: 2 };
    const result = mergeActivityMetrics(original as never, { eventCount: 1, bytes: 12 });
    expect(result).toMatchObject({ eventCount: 3, bytes: 12 });
    expect(original.eventCount).toBe(2);
  });
});
