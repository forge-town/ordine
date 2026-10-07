import { describe, expect, it } from "vitest";
import { unwrap } from "./jobRunnerUnwrap.helper";

describe("jobRunnerUnwrap", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(unwrap).toBeTypeOf("function");
  });
});
