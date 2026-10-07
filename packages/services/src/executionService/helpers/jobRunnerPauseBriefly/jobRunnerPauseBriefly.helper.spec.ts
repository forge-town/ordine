import { describe, expect, it } from "vitest";
import { pauseBriefly } from "./jobRunnerPauseBriefly.helper";

describe("jobRunnerPauseBriefly", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(pauseBriefly).toBeTypeOf("function");
  });
});
