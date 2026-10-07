import { describe, expect, it } from "vitest";
import { attemptState } from "./jobRunnerAttemptState.helper";

describe("jobRunnerAttemptState", () => {
  it("keeps the extracted helper factory or function publicly callable", () => {
    expect(attemptState).toBeTypeOf("function");
  });
});
