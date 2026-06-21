import { describe, expect, it } from "vitest";
import { createCanvasPageStore } from "./canvasPageStore";
import type { PipelineEdge, PipelineNode } from "./canvasSlice";

const makeNode = (id: string): PipelineNode =>
  ({
    id,
    type: "folder",
    position: { x: 0, y: 0 },
    data: { label: id, nodeType: "folder" },
  }) as PipelineNode;

const makeEdge = (id: string): PipelineEdge =>
  ({
    id,
    source: "node-a",
    target: "node-b",
    type: "default",
    data: {},
  }) as PipelineEdge;

describe("workspaceInteractionSlice", () => {
  it("provides workspace interaction defaults", () => {
    const state = createCanvasPageStore().getState();

    expect(state.drillStack).toEqual([]);
    expect(state.selectedIds).toEqual([]);
    expect(state.configNodeId).toBeNull();
    expect(state.inspectEdgeId).toBeNull();
    expect(state.annotatingId).toBeNull();
    expect(state.viewingAnnId).toBeNull();
    expect(state.composingNodeIds).toBeNull();
    expect(state.compPanelOpen).toBe(true);
    expect(state.phase).toBe("empty");
  });

  it("updates drill stack actions", () => {
    const store = createCanvasPageStore();

    store.getState().setDrillStack(["compound-a"]);
    expect(store.getState().drillStack).toEqual(["compound-a"]);

    store.getState().pushDrillStack("compound-b");
    expect(store.getState().drillStack).toEqual(["compound-a", "compound-b"]);

    store.getState().popDrillStack();
    expect(store.getState().drillStack).toEqual(["compound-a"]);

    store.getState().clearDrillStack();
    expect(store.getState().drillStack).toEqual([]);
  });

  it("updates selection, panel, inspection, annotation, and phase actions", () => {
    const store = createCanvasPageStore();

    store.getState().setSelectedIds(["node-a", "node-b"]);
    store.getState().setConfigNodeId("node-a");
    store.getState().setInspectEdgeId("edge-a");
    store.getState().setAnnotatingId("node-b");
    store.getState().setViewingAnnId("ann-a");
    store.getState().setComposingNodeIds(["node-a", "node-b"]);
    store.getState().setCompPanelOpen(false);
    store.getState().toggleCompPanelOpen();
    store.getState().setWorkspacePhase("proposal");

    const state = store.getState();
    expect(state.selectedIds).toEqual(["node-a", "node-b"]);
    expect(state.configNodeId).toBe("node-a");
    expect(state.inspectEdgeId).toBe("edge-a");
    expect(state.annotatingId).toBe("node-b");
    expect(state.viewingAnnId).toBe("ann-a");
    expect(state.composingNodeIds).toEqual(["node-a", "node-b"]);
    expect(state.compPanelOpen).toBe(true);
    expect(state.phase).toBe("proposal");
  });

  it("syncs selected ids from existing canvas selection actions", () => {
    const store = createCanvasPageStore(
      [makeNode("node-a"), makeNode("node-b")],
      [makeEdge("edge-a")],
    );

    store.getState().selectNode("node-a");
    expect(store.getState().selectedIds).toEqual(["node-a"]);

    store.getState().focusEdge("edge-a");
    expect(store.getState().selectedIds).toEqual(["edge-a"]);

    store.getState().clearSelection();
    expect(store.getState().selectedIds).toEqual([]);

    store.getState().focusNode("node-b");
    expect(store.getState().selectedIds).toEqual(["node-b"]);

    store.getState().clearCanvas();
    expect(store.getState().selectedIds).toEqual([]);
  });
});
