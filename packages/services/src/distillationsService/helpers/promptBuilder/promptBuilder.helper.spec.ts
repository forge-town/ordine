import { describe, expect, it } from "vitest";
import { stringifyForPrompt } from "./promptBuilder.helper";
describe("stringifyForPrompt", () => {
  it("retains structured evidence as readable JSON", () => {
    expect(JSON.parse(stringifyForPrompt({ evidence: ["decisive trace"] }))).toEqual({
      evidence: ["decisive trace"],
    });
  });
  it("bounds oversized evidence and marks it as truncated", () => {
    const source = "x".repeat(40_000);
    const result = stringifyForPrompt({ source });
    expect(result.length).toBeLessThan(source.length);
    expect(result.endsWith("... (truncated)")).toBe(true);
  });
});
