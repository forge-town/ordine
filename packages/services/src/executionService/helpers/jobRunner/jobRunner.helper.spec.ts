import { describe, expect, it } from "vitest";
import { createExecutionJobRunner } from "./jobRunner.helper";

describe("jobRunner", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createExecutionJobRunner).toBeTypeOf("function");
  });
});
