import { describe, expect, it } from "vitest";
import { createRequireJobHelper } from "./requireJob.helper";

describe("requireJob", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(createRequireJobHelper).toBeTypeOf("function");
  });
});
