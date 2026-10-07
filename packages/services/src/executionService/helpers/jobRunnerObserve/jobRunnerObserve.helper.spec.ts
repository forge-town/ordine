import { describe, expect, it } from "vitest";
import { createJobRunnerObserveHelper } from "./jobRunnerObserve.helper";

describe("jobRunnerObserve", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createJobRunnerObserveHelper).toBeTypeOf("function");
  });
});
