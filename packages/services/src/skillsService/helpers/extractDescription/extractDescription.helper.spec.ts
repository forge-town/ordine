import { describe, expect, it } from "vitest";
import { extractDescription } from "./extractDescription.helper";

describe("extractDescription", () => {
  it("preserves skill import and analysis metadata", () => {
    expect(extractDescription("# First paragraph\n\nOther details")).toBe("First paragraph");
    expect(extractDescription("# Body", "  Explicit description  ")).toBe("Explicit description");
  });
});
