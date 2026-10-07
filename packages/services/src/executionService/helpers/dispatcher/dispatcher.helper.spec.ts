import { describe, expect, it } from "vitest";
import { createExecutionDispatcher } from "./dispatcher.helper";

describe("dispatcher", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createExecutionDispatcher).toBeTypeOf("function");
  });
});
