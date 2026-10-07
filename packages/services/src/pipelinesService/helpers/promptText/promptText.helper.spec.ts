import { describe, expect, it } from "vitest";
import { truncate } from "./promptText.helper";
describe("promptText", () => {
  it("retains the Pipeline content and error boundary", () => {
    expect(truncate("evidence", 8)).toBe("evidence");
    expect(truncate("long evidence", 4)).toBe("long\n... (truncated)");
  });
});
