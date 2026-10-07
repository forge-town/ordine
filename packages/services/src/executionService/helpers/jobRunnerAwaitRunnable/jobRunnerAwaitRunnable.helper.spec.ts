import { describe, expect, it } from "vitest";
import { createJobRunnerAwaitRunnableHelper } from "./jobRunnerAwaitRunnable.helper";

describe("jobRunnerAwaitRunnable", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createJobRunnerAwaitRunnableHelper).toBeTypeOf("function");
  });
});
