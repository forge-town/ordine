import { describe, expect, it } from "vitest";
import { createScopedHelper } from "./scoped.helper";

describe("scoped", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createScopedHelper).toBeTypeOf("function");
  });
});
