import { describe, expect, it } from "vitest";
import { createJobRunnerRefreshHelper } from "./jobRunnerRefresh.helper";

describe("jobRunnerRefresh", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createJobRunnerRefreshHelper).toBeTypeOf("function");
  });
});
