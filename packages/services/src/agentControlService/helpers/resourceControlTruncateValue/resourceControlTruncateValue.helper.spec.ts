import { describe, expect, it } from "vitest";
import { truncateValue } from "./resourceControlTruncateValue.helper";

describe("resourceControlTruncateValue", () => {
  it("retains the Agent Control contract boundary", () => {
    const value = "x".repeat(3000);
    const result = truncateValue({ value }) as { value: string };
    expect(result.value.length).toBeLessThan(value.length);
    expect(result.value.endsWith("…")).toBe(true);
  });
});
