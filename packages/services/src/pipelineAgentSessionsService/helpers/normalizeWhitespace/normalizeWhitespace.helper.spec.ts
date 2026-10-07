import { describe, expect, it } from "vitest";
import { createNormalizeWhitespaceHelper } from "./normalizeWhitespace.helper";
describe("normalizeWhitespace", () => {
  it("normalizes document spacing for visible attachment text", () => {
    expect(createNormalizeWhitespaceHelper({})("  first\n\tsecond  ")).toBe("first second");
  });
});
