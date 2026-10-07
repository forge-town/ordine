import { describe, expect, it } from "vitest";
import { createInvokeInternalHelper } from "./invokeInternal.helper";

describe("invokeInternal", () => {
  it("retains the Agent Control contract boundary", async () => {
    const result = await createInvokeInternalHelper({} as never)(
      "unknown.tool",
      {},
      {} as never,
      {} as never,
    );
    expect(result).toMatchObject({
      status: "failed",
      retry: { code: "TOOL_NOT_FOUND", retryable: false },
    });
  });
});
