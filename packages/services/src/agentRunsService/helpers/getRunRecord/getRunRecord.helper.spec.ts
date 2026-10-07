import { describe, expect, it, vi } from "vitest";
import { createGetRunRecordHelper } from "./getRunRecord.helper";

describe("getRunRecord", () => {
  it("retains the Agent Run boundary contract", async () => {
    const getRunRecord = createGetRunRecordHelper({
      runsDao: { findById: vi.fn().mockResolvedValue(null) },
    } as never);
    await expect(getRunRecord("missing")).rejects.toThrow("Agent run not found: missing");
  });
});
