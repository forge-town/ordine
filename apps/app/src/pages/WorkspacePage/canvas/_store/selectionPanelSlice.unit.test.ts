import { createStore } from "zustand/vanilla";
import { describe, expect, it } from "vitest";
import { createGraphSlice, type GraphSlice } from "./graphSlice";
import { createPanelSlice, type PanelSlice } from "./panelSlice";
import { createSelectionSlice, type SelectionSlice } from "./selectionSlice";
import type { CanvasEdge, CanvasNode } from "./canvasTypes";

type TestStoreState = GraphSlice & PanelSlice & SelectionSlice;

const makeNode = (id: string): CanvasNode => ({
  id,
  type: "file",
  position: { x: 0, y: 0 },
  data: {
    label: `Node ${id}`,
    nodeType: "file",
    filePath: `/tmp/${id}.txt`,
  },
});

const edge: CanvasEdge = {
  id: "edge-a",
  source: "node-a",
  target: "node-b",
  type: "semantic",
  data: { label: "Edge A" },
};

const createTestStore = () =>
  createStore<TestStoreState>()((set, get, store) => ({
    ...createGraphSlice({ edges: [edge], nodes: [makeNode("node-a"), makeNode("node-b")] })(
      set,
      get,
      store,
    ),
    ...createPanelSlice<TestStoreState>()(set, get, store),
    ...createSelectionSlice<TestStoreState>()(set, get, store),
  }));

describe("selection and panel slices", () => {
  it("selects nodes and edges with replace, add, and toggle modes", () => {
    const store = createTestStore();

    store.getState().selectNode("node-a");
    store.getState().selectNode("node-b", "add");
    store.getState().selectNode("node-a", "toggle");
    store.getState().selectEdge("edge-a", "add");

    expect(store.getState().selectedNodeId).toBe("node-a");
    expect(store.getState().selectedEdgeId).toBe("edge-a");
    expect(store.getState().selectedIds).toEqual(["node-b", "edge-a"]);
  });

  it("builds structured refs for the current selection", () => {
    const store = createTestStore();

    store.getState().setSelectedIds(["node-a", "edge-a"]);

    expect(store.getState().getSelectedRefs()).toEqual([
      { id: "node-a", label: "Node node-a", type: "node" },
      { id: "edge-a", label: "Edge A", type: "edge" },
    ]);
  });

  it("clears the selection", () => {
    const store = createTestStore();

    store.getState().setSelectedIds(["node-a", "edge-a"]);
    store.getState().clearSelection();

    expect(store.getState().selectedEdgeId).toBeNull();
    expect(store.getState().selectedNodeId).toBeNull();
    expect(store.getState().selectedIds).toEqual([]);
  });

  it("opens mutually exclusive config and edge inspector panels", () => {
    const store = createTestStore();

    store.getState().openNodeConfig("node-a");
    expect(store.getState().configNodeId).toBe("node-a");
    expect(store.getState().inspectEdgeId).toBeNull();

    store.getState().openEdgeInspector("edge-a");
    expect(store.getState().configNodeId).toBeNull();
    expect(store.getState().inspectEdgeId).toBe("edge-a");
  });

  it("updates lightweight panel state", () => {
    const store = createTestStore();

    store.getState().setAnnotatingId("node-a");
    store.getState().setViewingAnnId("ann-a");
    store.getState().setComposingNodeIds(["node-a", "node-b"]);
    store.getState().setCompPanelOpen(false);
    store.getState().toggleCompPanelOpen();
    store.getState().closePanels();

    expect(store.getState().annotatingId).toBeNull();
    expect(store.getState().viewingAnnId).toBeNull();
    expect(store.getState().composingNodeIds).toBeNull();
    expect(store.getState().compPanelOpen).toBe(true);
  });
});
