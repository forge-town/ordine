import { describe, expect, it } from "vitest";
import { toPublicChangeSet } from "./toPublicChangeSet.helper";
describe("toPublicChangeSet", () => {
  it("retains graph versions and serialized lifecycle dates", () => {
    const result = toPublicChangeSet({
      id: "change-1",
      threadId: "thread-1",
      runId: null,
      actor: "local-owner",
      kind: "agent-edit",
      originChangeSetId: null,
      targetType: "pipeline",
      targetId: "pipeline-1",
      baseVersion: 1,
      revision: 1,
      appliedVersion: null,
      status: "drafting",
      baseSnapshot: { nodes: [], edges: [] },
      draftSnapshot: { nodes: [], edges: [] },
      createdAt: new Date(0),
      updatedAt: new Date(0),
      committedAt: null,
    } as never);
    expect(result.target).toEqual({ type: "pipeline", id: "pipeline-1" });
    expect(result.baseVersion).toBe(1);
    expect(result.committedAt).toBeNull();
  });
});
