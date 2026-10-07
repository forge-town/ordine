import { describe, expect, it } from "vitest";
import { createJobRunnerStopHelper } from "./jobRunnerStop.helper";

describe("jobRunnerStop", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createJobRunnerStopHelper).toBeTypeOf("function");
  });
});
