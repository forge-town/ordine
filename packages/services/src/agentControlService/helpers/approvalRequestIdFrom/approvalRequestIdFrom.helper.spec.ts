import { describe, expect, it } from "vitest";
import { approvalRequestIdFrom } from "./approvalRequestIdFrom.helper";

describe("approvalRequestIdFrom", () => {
  it("retains the Agent Control contract boundary", () => {
    expect(approvalRequestIdFrom({ approvalRequestId: "approval-1" })).toBe("approval-1");
    expect(approvalRequestIdFrom({ approvalRequestId: 7 })).toBeNull();
  });
});
