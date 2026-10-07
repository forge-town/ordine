import { describe, expect, it, vi } from "vitest";
import { createRejectApprovalMethod } from "./rejectApproval.method";

describe("rejectApproval", () => {
  it("retains the Agent Control contract boundary", async () => {
    expect(
      await createRejectApprovalMethod({
        approvalsDao: { reject: vi.fn().mockResolvedValue(null) },
      } as never)("missing"),
    ).toBeNull();
  });
});
