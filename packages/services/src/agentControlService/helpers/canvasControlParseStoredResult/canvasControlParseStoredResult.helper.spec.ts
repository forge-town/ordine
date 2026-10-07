import { describe, expect, it } from "vitest";
import { parseStoredResult } from "./canvasControlParseStoredResult.helper";

describe("canvasControlParseStoredResult", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(parseStoredResult("action-1", "started", null)).toMatchObject({
      status: "failed",
      retry: { code: "ACTION_IN_PROGRESS", retryable: true },
    });
  });
});
