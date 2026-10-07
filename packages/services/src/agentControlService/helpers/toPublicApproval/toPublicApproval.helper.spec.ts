import { describe, expect, it } from "vitest";
import { toPublicApproval } from "./toPublicApproval.helper";
describe("toPublicApproval", () => {
  it("retains pending approval status and expiry for public review", () => {
    const result = toPublicApproval({
      id: "approval-1",
      threadId: "thread-1",
      runId: null,
      actionId: "action-1",
      toolName: "ordine.delete_resource",
      callId: "call-1",
      argumentDigest: "a".repeat(64),
      targetType: "project",
      targetId: "project-1",
      resourceVersion: null,
      status: "pending",
      expiresAt: new Date(0),
      approvedAt: null,
      consumedAt: null,
      createdAt: new Date(0),
    } as never);
    expect(result.status).toBe("pending");
    expect(result.target).toEqual({ type: "project", id: "project-1" });
    expect(result.expiresAt).toBe(new Date(0).toISOString());
  });
});
