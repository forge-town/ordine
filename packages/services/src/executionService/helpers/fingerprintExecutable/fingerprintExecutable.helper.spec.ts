import { describe, expect, it } from "vitest";
import { fingerprintExecutable } from "./fingerprintExecutable.helper";

describe("fingerprintExecutable", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(fingerprintExecutable).toBeTypeOf("function");
  });
});
