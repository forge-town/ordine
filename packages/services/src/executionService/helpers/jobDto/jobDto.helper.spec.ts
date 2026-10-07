import { describe, expect, it } from "vitest";
import { jobDto } from "./jobDto.helper";

describe("jobDto", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(jobDto).toBeTypeOf("function");
  });
});
