import { describe, expect, it, vi } from "vitest";
import { createApproveMethod } from "./approve.method";

describe("approve", () => {
  it("retains the Agent Control contract boundary", async () => {
    const approve = createApproveMethod({
      approvalsDao: {
        expirePending: vi.fn().mockResolvedValue(undefined),
        approve: vi.fn().mockResolvedValue(null),
      },
    } as never);
    expect(await approve("missing")).toBeNull();
  });
});
