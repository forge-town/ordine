import { describe, expect, it, vi } from "vitest";
import { createExecutionPreflightOperationMethod } from "./executionPreflightOperation.method";
import { err } from "neverthrow";

describe("executionPreflightOperation", () => {
  it("retains the Agent Control contract boundary", async () => {
    const failure = { code: "OPERATION_NOT_FOUND", message: "missing", retryable: true };
    const result = await createExecutionPreflightOperationMethod({
      inspectOperations: vi.fn().mockResolvedValue(err(failure)),
    } as never)("missing");
    expect(result._unsafeUnwrapErr()).toEqual(failure);
  });
});
