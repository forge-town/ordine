import { describe, expect, it } from "vitest";
import { ExecutionServiceFailure } from "./serviceResult.helper";

describe("serviceResult", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(ExecutionServiceFailure).toBeTypeOf("function");
  });
});
