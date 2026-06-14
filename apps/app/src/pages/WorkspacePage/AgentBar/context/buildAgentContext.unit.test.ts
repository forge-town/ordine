import { describe, expect, it } from "vitest";
import type { WorkspaceCanvasRef } from "@repo/schemas";
import { buildAgentContext, HISTORY_WINDOW_LIMIT } from "./buildAgentContext";

const ref = (id: string, type: "node" | "edge" = "node"): WorkspaceCanvasRef => ({
  baseId: id,
  id,
  kind: "operation",
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
  it("produces the default payload snapshot", () => {
    expect(buildAgentContext(baseInput)).toEqual({
      anchors: [],
      project: { pipelineId: "pipeline-1", pipelineName: "Demo" },
      runState: undefined,
      selection: [],
      snapshotIncluded: true,
      threadWindow: { enabled: false, limit: HISTORY_WINDOW_LIMIT },
    });
  });

  it("maps active refs into selection and skips dismissed ones", () => {
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

  it("keeps only positive anchor counts and resolves labels", () => {
    const payload = buildAgentContext({
      ...baseInput,
      anchorCounts: { "node-1": 2, "node-2": 0 },
      refLabelById: { "node-1": "Parse" },
    });

    expect(payload.anchors).toEqual([{ count: 2, label: "Parse", refId: "node-1" }]);
  });

  it("includes runState for an active job", () => {
    const payload = buildAgentContext({
      ...baseInput,
      activeJob: { id: "job-1", status: "running" },
      nodeRunStatuses: { "node-1": "running" },
    });

    expect(payload.runState).toEqual({
      jobId: "job-1",
      nodeStatuses: { "node-1": "running" },
      status: "running",
    });
  });

  it("falls back to the latest job only when it failed", () => {
    const failed = buildAgentContext({
      ...baseInput,
      latestJob: { id: "job-9", status: "failed" },
    });
    const succeeded = buildAgentContext({
      ...baseInput,
      latestJob: { id: "job-9", status: "succeeded" },
    });

    expect(failed.runState?.jobId).toBe("job-9");
    expect(succeeded.runState).toBeUndefined();
  });

  it("omits project when there is no pipeline and never sets memory", () => {
    const payload = buildAgentContext({ ...baseInput, hasConversation: true, pipelineId: null });

    expect(payload.project).toBeUndefined();
    expect(payload.memory).toBeUndefined();
    expect(payload.threadWindow.enabled).toBe(true);
  });
});
