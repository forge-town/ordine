import { describe, expect, it } from "vitest";
import { createJobRunnerRunMethod } from "./jobRunnerRun.method";
describe("jobRunnerRun", () => {
  it("constructs a callable runner boundary", () => {
    expect(typeof createJobRunnerRunMethod({} as never)).toBe("function");
  });
});
