import { describe, expect, it } from "vitest";
import { createExecutionProcessLimiter } from "./processLimiter.helper";

describe("processLimiter", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createExecutionProcessLimiter).toBeTypeOf("function");
  });
});
