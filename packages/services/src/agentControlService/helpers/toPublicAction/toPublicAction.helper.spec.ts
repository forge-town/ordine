import { describe, expect, it } from "vitest";
import { toPublicAction } from "./toPublicAction.helper";
describe("toPublicAction", () => {
  it("serializes public action ownership and completion dates", () => {
    const result = toPublicAction({
      id: "action-1",
      threadId: "thread-1",
      runId: null,
      changeSetId: null,
      sequence: 1,
      toolName: "ordine.search",
      risk: "read",
      status: "failed",
      targetType: "project",
      targetId: "project-1",
      redactedInput: {},
      result: null,
      forwardAction: null,
      inverseActions: null,
      idempotencyKey: "call-1",
      createdAt: new Date(0),
      completedAt: null,
    } as never);
    expect(result.target).toEqual({ type: "project", id: "project-1" });
    expect(result.createdAt).toBe(new Date(0).toISOString());
    expect(result.completedAt).toBeNull();
  });
});
