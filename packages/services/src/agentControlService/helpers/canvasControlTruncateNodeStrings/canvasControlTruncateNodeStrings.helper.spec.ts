import { describe, expect, it } from "vitest";
import { truncateNodeStrings } from "./canvasControlTruncateNodeStrings.helper";

describe("canvasControlTruncateNodeStrings", () => {
  it("retains the Agent Control contract boundary", () => {
    const input = { label: "x".repeat(5000) };
    const result = truncateNodeStrings(input) as { label: string };
    expect(result.label.length).toBeLessThan(input.label.length);
    expect(input.label.length).toBe(5000);
  });
});
