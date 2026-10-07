import { describe, expect, it } from "vitest";
import { preparedSubmissionValue } from "./preparedSubmissionValue.helper";

describe("preparedSubmissionValue", () => {
  it("retains the Agent Control contract boundary", () => {
    const result = preparedSubmissionValue({ type: "pipeline", id: "pipeline-1" }, {});
    expect(result._unsafeUnwrapErr()).toMatchObject({
      code: "EXECUTION_RECEIPT_INVALID",
      retryable: false,
    });
  });
});
