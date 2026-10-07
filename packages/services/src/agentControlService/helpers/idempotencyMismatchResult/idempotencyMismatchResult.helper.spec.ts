import { describe, expect, it } from "vitest";
import { idempotencyMismatchResult } from "./idempotencyMismatchResult.helper";

describe("idempotencyMismatchResult", () => {
  it("retains the Agent Control contract boundary", () => {
    const result = idempotencyMismatchResult(
      { id: "action-1", argumentDigest: "original" } as never,
      "changed",
      [],
    );
    expect(result).toMatchObject({
      status: "failed",
      retry: { code: "IDEMPOTENCY_ARGUMENT_MISMATCH", retryable: false },
    });
  });
});
