import { describe, expect, it } from "vitest";
import { stopped } from "./processLimiterStopped.helper";

describe("processLimiterStopped", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(stopped).toBeTypeOf("function");
  });
});
