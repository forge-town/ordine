import { describe, expect, it } from "vitest";
import { createJobRunnerConvergeWaitingHelper } from "./jobRunnerConvergeWaiting.helper";

describe("jobRunnerConvergeWaiting", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createJobRunnerConvergeWaitingHelper).toBeTypeOf("function");
  });
});
