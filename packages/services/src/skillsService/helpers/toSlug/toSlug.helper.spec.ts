import { describe, expect, it } from "vitest";
import { toSlug } from "./toSlug.helper";

describe("toSlug", () => {
  it("preserves skill import and analysis metadata", () => {
    expect(toSlug("  Code / Review_2  ")).toBe("code-review-2");
    expect(toSlug("---")).toBe("");
  });
});
