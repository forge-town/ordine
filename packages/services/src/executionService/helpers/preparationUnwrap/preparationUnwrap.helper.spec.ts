import { describe, expect, it } from "vitest";
import { unwrap } from "./preparationUnwrap.helper";

describe("preparationUnwrap", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(unwrap).toBeTypeOf("function");
  });
});
