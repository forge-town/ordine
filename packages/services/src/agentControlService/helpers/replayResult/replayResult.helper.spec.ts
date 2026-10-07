import { describe, expect, it } from "vitest";
import { replayResult } from "./replayResult.helper";

describe("replayResult", () => {
  it("retains the Agent Control contract boundary", () => {
    const result = replayResult({ id: "action-1", status: "started", result: null } as never);
    expect(result).toMatchObject({
      status: "failed",
      retry: { code: "ACTION_IN_PROGRESS", retryable: true },
    });
  });
});
