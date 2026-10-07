import { describe, expect, it } from "vitest";
import { createJobRunnerAbortWithHelper } from "./jobRunnerAbortWith.helper";

describe("jobRunnerAbortWith", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createJobRunnerAbortWithHelper).toBeTypeOf("function");
  });
});
