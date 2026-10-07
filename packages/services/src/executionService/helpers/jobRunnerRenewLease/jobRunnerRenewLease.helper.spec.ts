import { describe, expect, it } from "vitest";
import { createJobRunnerRenewLeaseHelper } from "./jobRunnerRenewLease.helper";

describe("jobRunnerRenewLease", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createJobRunnerRenewLeaseHelper).toBeTypeOf("function");
  });
});
