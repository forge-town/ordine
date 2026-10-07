import { describe, expect, it } from "vitest";
import { createProcessLimiterPumpHelper } from "./processLimiterPump.helper";

describe("processLimiterPump", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createProcessLimiterPumpHelper).toBeTypeOf("function");
  });
});
