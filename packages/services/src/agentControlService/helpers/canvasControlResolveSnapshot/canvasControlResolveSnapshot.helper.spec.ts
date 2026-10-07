import { describe, expect, it, vi } from "vitest";
import { createCanvasControlResolveSnapshotHelper } from "./canvasControlResolveSnapshot.helper";

describe("canvasControlResolveSnapshot", () => {
  it("retains the Agent Control contract boundary", async () => {
    const pipeline = { id: "pipeline-1", nodes: [], edges: [] };
    const change = {
      threadId: "other",
      targetType: "pipeline",
      targetId: "pipeline-1",
      draftSnapshot: { nodes: ["private"], edges: [] },
    };
    const resolve = createCanvasControlResolveSnapshotHelper({
      pipelinesDao: { findById: vi.fn().mockResolvedValue(pipeline) },
      changeSetsDao: { findById: vi.fn().mockResolvedValue(change) },
    } as never);
    const result = await resolve({
      pipelineId: "pipeline-1",
      threadId: "thread-1",
      changeSetId: "change-1",
    });
    expect(result?.changeSet).toBeNull();
    expect(result?.snapshot).toEqual({ nodes: [], edges: [] });
  });
});
