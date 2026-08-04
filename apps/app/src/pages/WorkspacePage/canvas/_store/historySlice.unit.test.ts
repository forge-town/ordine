import { createStore } from "zustand/vanilla";
import { describe, expect, it } from "vitest";
import { createGraphSlice, type GraphSlice } from "./graphSlice";
import { createHistorySlice, type HistorySlice } from "./historySlice";
import type { CanvasEdge, CanvasNode } from "./canvasTypes";

type TestStoreState = HistorySlice & {
  edges: CanvasEdge[];
  nodes: CanvasNode[];
};

const makeNode = (id: string): CanvasNode => ({
  data: {
    label: id,
    nodeType: "file",
    filePath: `${id}.ts`,
  },
  id,
  position: { x: 0, y: 0 },
  type: "file",
});

const makeStore = () =>
  createStore<TestStoreState>()((set, get, store) => ({
    edges: [],
    nodes: [makeNode("node-a")],
    ...createHistorySlice<TestStoreState>()(set, get, store),
  }));

type GraphHistoryStoreState = GraphSlice & HistorySlice;

const makeGraphHistoryStore = () =>
  createStore<GraphHistoryStoreState>()((set, get, store) => ({
    ...createGraphSlice<GraphHistoryStoreState>({ nodes: [makeNode("node-a")] })(set, get, store),
    ...createHistorySlice<GraphHistoryStoreState>()(set, get, store),
  }));

describe("historySlice", () => {
  it("undoes and redoes graph snapshots", () => {
    const store = makeStore();
    const previous = {
      edges: store.getState().edges,
      nodes: store.getState().nodes,
    };

    store.setState({ nodes: [...store.getState().nodes, makeNode("node-b")] });
    store.getState().recordHistory(previous);

    expect(store.getState().canUndo).toBe(true);
    expect(store.getState().nodes.map((node) => node.id)).toEqual(["node-a", "node-b"]);

    store.getState().undo();
    expect(store.getState().nodes.map((node) => node.id)).toEqual(["node-a"]);
    expect(store.getState().canRedo).toBe(true);

    store.getState().redo();
    expect(store.getState().nodes.map((node) => node.id)).toEqual(["node-a", "node-b"]);
  });

  it("skips unchanged snapshots", () => {
    const store = makeStore();

    store.getState().recordHistory({
      edges: store.getState().edges,
      nodes: store.getState().nodes,
    });

    expect(store.getState().historyPast).toEqual([]);
    expect(store.getState().canUndo).toBe(false);
  });

  it("records graph actions so they can be undone", () => {
    const store = makeGraphHistoryStore();

    store.getState().addNode(makeNode("node-b"));
    expect(store.getState().canUndo).toBe(true);

    store.getState().undo();
    expect(store.getState().nodes.map((node) => node.id)).toEqual(["node-a"]);
  });

  it("records a drag interaction as one history entry", () => {
    const store = makeGraphHistoryStore();

    store
      .getState()
      .handleNodesChange([
        { id: "node-a", type: "position", position: { x: 10, y: 0 }, dragging: true },
      ]);
    store
      .getState()
      .handleNodesChange([
        { id: "node-a", type: "position", position: { x: 20, y: 0 }, dragging: true },
      ]);
    store
      .getState()
      .handleNodesChange([
        { id: "node-a", type: "position", position: { x: 30, y: 0 }, dragging: false },
      ]);

    expect(store.getState().historyPast).toHaveLength(1);
    store.getState().undo();
    expect(store.getState().nodes[0]?.position).toEqual({ x: 0, y: 0 });
  });
});
