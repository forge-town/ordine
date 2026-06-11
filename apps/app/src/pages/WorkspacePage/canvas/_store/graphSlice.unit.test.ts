import { createStore } from "zustand/vanilla";
import { describe, expect, it } from "vitest";
import type { CompoundNodeData } from "@repo/schemas";
import { createGraphSlice, type GraphSlice } from "./graphSlice";
import type { CanvasEdge, CanvasNode } from "./canvasTypes";

const makeFileNode = (id: string, x = 0, y = 0): CanvasNode => ({
  id,
  type: "file",
  position: { x, y },
  data: {
    label: id,
    nodeType: "file",
    filePath: `/tmp/${id}.txt`,
  },
});

const makeOperationNode = (id: string, x = 0, y = 0): CanvasNode => ({
  id,
  type: "operation",
  position: { x, y },
  data: {
    label: id,
    nodeType: "operation",
    operationId: id,
    operationName: id,
    status: "idle",
  },
});

const makeOutputNode = (id: string, x = 0, y = 0): CanvasNode => ({
  id,
  type: "output-local-path",
  position: { x, y },
  data: {
    label: id,
    nodeType: "output-local-path",
    localPath: `/tmp/${id}`,
  },
});

const makeEdge = (id: string, source: string, target: string): CanvasEdge => ({
  id,
  source,
  target,
  type: "semantic",
  animated: true,
  data: { label: id },
});

const createGraphStore = (nodes: CanvasNode[] = [], edges: CanvasEdge[] = []) =>
  createStore<GraphSlice>()(createGraphSlice({ edges, nodes }));

describe("graphSlice", () => {
  it("adds valid connections and rejects invalid node type pairs", () => {
    const store = createGraphStore([
      makeFileNode("file"),
      makeOperationNode("operation"),
      makeOutputNode("output"),
    ]);

    store.getState().handleConnect({
      source: "file",
      sourceHandle: null,
      target: "operation",
      targetHandle: null,
    });
    store.getState().handleConnect({
      source: "output",
      sourceHandle: null,
      target: "operation",
      targetHandle: null,
    });

    expect(store.getState().edges).toHaveLength(1);
    expect(store.getState().edges[0]).toMatchObject({
      source: "file",
      target: "operation",
      type: "semantic",
      animated: true,
    });
  });

  it("creates catalog nodes, duplicates them, and deletes connected edges", () => {
    const store = createGraphStore(
      [makeFileNode("file"), makeOperationNode("operation")],
      [makeEdge("edge-file-operation", "file", "operation")],
    );

    const catalogNode = store.getState().addNodeFromCatalog({
      id: "folder",
      position: { x: 10, y: 20 },
      type: "folder",
    });
    const duplicate = store.getState().duplicateNode("folder", "folder-copy");
    store.getState().deleteNode("file");

    expect(catalogNode.data).toMatchObject({ label: "Folder", nodeType: "folder" });
    expect(duplicate?.position).toEqual({ x: 50, y: 60 });
    expect(store.getState().edges).toEqual([]);
    expect(store.getState().nodes.map((node) => node.id)).toEqual([
      "operation",
      "folder",
      "folder-copy",
    ]);
  });

  it("composes selected nodes into a compound node and rewires boundary edges", () => {
    const store = createGraphStore(
      [
        makeFileNode("outside-in", -240, 0),
        makeFileNode("node-a", 0, 0),
        makeFileNode("node-b", 260, 0),
        makeFileNode("outside-out", 560, 0),
      ],
      [
        makeEdge("edge-in", "outside-in", "node-a"),
        makeEdge("edge-internal", "node-a", "node-b"),
        makeEdge("edge-out", "node-b", "outside-out"),
      ],
    );

    const compound = store
      .getState()
      .composeNodes(["node-a", "node-b"], { id: "compound-1", label: "Review pair" });
    const state = store.getState();
    const compoundData = compound?.data as CompoundNodeData | undefined;

    expect(compoundData?.label).toBe("Review pair");
    expect(compoundData?.childNodeIds).toEqual(["node-a", "node-b"]);
    expect(compoundData?.childEdges).toEqual([
      expect.objectContaining({ id: "edge-internal", source: "node-a", target: "node-b" }),
    ]);
    expect(state.nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["outside-in", "outside-out", "compound-1", "node-a", "node-b"]),
    );
    expect(state.nodes.findIndex((node) => node.id === "compound-1")).toBeLessThan(
      state.nodes.findIndex((node) => node.id === "node-a"),
    );
    expect(state.nodes.find((node) => node.id === "node-a")?.parentId).toBe("compound-1");
    expect(state.edges).toEqual([
      expect.objectContaining({ id: "e-outside-in-compound-1-edge-in" }),
      expect.objectContaining({ id: "e-compound-1-outside-out-edge-out" }),
    ]);
  });

  it("returns compound children and child edges for the active drill stack", () => {
    const store = createGraphStore(
      [makeFileNode("node-a", 0, 0), makeFileNode("node-b", 260, 0)],
      [makeEdge("edge-internal", "node-a", "node-b")],
    );

    store.getState().composeNodes(["node-a", "node-b"], { id: "compound-1" });
    store.getState().pushDrillStack("compound-1");

    const visible = store.getState().getVisibleGraph();

    expect(visible.nodes.map((node) => [node.id, node.parentId])).toEqual([
      ["node-a", undefined],
      ["node-b", undefined],
    ]);
    expect(visible.edges).toEqual([
      expect.objectContaining({
        id: "edge-internal",
        source: "node-a",
        target: "node-b",
        type: "semantic",
        animated: true,
      }),
    ]);
  });

  it("ungroups a compound node and restores its internal edges", () => {
    const store = createGraphStore(
      [makeFileNode("node-a", 0, 0), makeFileNode("node-b", 260, 0)],
      [makeEdge("edge-internal", "node-a", "node-b")],
    );

    store.getState().composeNodes(["node-a", "node-b"], { id: "compound-1" });
    store.getState().pushDrillStack("compound-1");
    store.getState().ungroupCompound("compound-1");

    expect(store.getState().drillStack).toEqual([]);
    expect(store.getState().nodes.map((node) => node.id)).toEqual(["node-a", "node-b"]);
    expect(store.getState().nodes.every((node) => node.parentId === undefined)).toBe(true);
    expect(store.getState().edges).toEqual([
      expect.objectContaining({ id: "edge-internal", source: "node-a", target: "node-b" }),
    ]);
  });
});
