import { describe, expect, it } from "vitest";
import { toLabel } from "./toLabel.helper";

describe("toLabel", () => {
  it("preserves skill import and analysis metadata", () => {
    expect(toLabel("code_review-lint")).toBe("Code Review Lint");
  });
});
