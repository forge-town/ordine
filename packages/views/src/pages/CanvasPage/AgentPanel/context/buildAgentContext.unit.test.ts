import { describe, expect, it } from "vitest";
import type { WorkspaceCanvasRef } from "@repo/schemas";
import { buildAgentContext, HISTORY_WINDOW_LIMIT } from "./buildAgentContext";

const ref = (id: string, type: "node" | "edge" = "node"): WorkspaceCanvasRef => ({
  baseId: id,
  id,
  kind: type,
  label: `Label ${id}`,
  path: [],
  type,
});

const baseInput = {
  activeJob: null,
  anchorCounts: {},
  canvasRefs: [],
  dismissed: [],
  hasConversation: false,
  latestJob: null,
  nodeRunStatuses: {},
  pipelineId: "pipeline-1" as string | null,
  pipelineName: "Demo",
};

describe("buildAgentContext", () => {
  it("serializes the default pipeline context", () => {
    expect(buildAgentContext(baseInput)).toEqual({
      anchors: [],
      project: { pipelineId: "pipeline-1", pipelineName: "Demo" },
      runState: undefined,
      selection: [],
      snapshotIncluded: true,
      threadWindow: { enabled: false, limit: HISTORY_WINDOW_LIMIT },
    });
  });

  it("maps active refs and excludes dismissed refs", () => {
    const payload = buildAgentContext({
      ...baseInput,
      canvasRefs: [ref("node-1"), ref("edge-1", "edge"), ref("node-2")],
      dismissed: ["node-2"],
    });

    expect(payload.selection).toEqual([
      { label: "Label node-1", refId: "node-1", type: "node" },
      { label: "Label edge-1", refId: "edge-1", type: "edge" },
    ]);
  });

  it("includes active run state and conversation history availability", () => {
    const payload = buildAgentContext({
      ...baseInput,
      activeJob: { id: "job-1", status: "running" },
      hasConversation: true,
      nodeRunStatuses: { "node-1": "running" },
    });

    expect(payload.runState).toEqual({
      jobId: "job-1",
      nodeStatuses: { "node-1": "running" },
      status: "running",
    });
    expect(payload.threadWindow.enabled).toBe(true);
  });

  it("falls back to the latest failed job and omits an absent project", () => {
    const payload = buildAgentContext({
      ...baseInput,
      latestJob: { id: "job-9", status: "failed" },
      pipelineId: null,
    });

    expect(payload.project).toBeUndefined();
    expect(payload.runState?.jobId).toBe("job-9");
    expect(payload.memory).toBeUndefined();
  });
});
