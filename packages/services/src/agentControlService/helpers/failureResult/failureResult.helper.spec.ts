import { describe, expect, it } from "vitest";
import { failureResult } from "./failureResult.helper";

describe("failureResult", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(
      failureResult({
        actionId: "action-1",
        error: { code: "DENIED", message: "denied", retryable: false, field: "scope" },
      }),
    ).toMatchObject({
      status: "failed",
      retry: { code: "DENIED", retryable: false, field: "scope" },
    });
  });
});
