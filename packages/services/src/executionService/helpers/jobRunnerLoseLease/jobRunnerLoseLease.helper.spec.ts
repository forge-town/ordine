import { describe, expect, it } from "vitest";
import { createJobRunnerLoseLeaseHelper } from "./jobRunnerLoseLease.helper";

describe("jobRunnerLoseLease", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createJobRunnerLoseLeaseHelper).toBeTypeOf("function");
  });
});
