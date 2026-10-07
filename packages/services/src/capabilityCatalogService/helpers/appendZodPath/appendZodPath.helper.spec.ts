import { describe, expect, it } from "vitest";
import { appendZodPath } from "./appendZodPath.helper";

describe("appendZodPath", () => {
  it("preserves catalog validation and presentation boundaries", () => {
    expect(appendZodPath("operations", [1, "config", "allowedTools", 0])).toBe(
      "operations[1].config.allowedTools[0]",
    );
  });
});
