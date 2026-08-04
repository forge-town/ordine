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
      animated: false,
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
    expect(compoundData?.boundaryEdges).toEqual([
      expect.objectContaining({ id: "edge-in", source: "outside-in", target: "node-a" }),
      expect.objectContaining({ id: "edge-out", source: "node-b", target: "outside-out" }),
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
        animated: false,
      }),
    ]);
  });

  it("stores new connections in the active compound while drilled in", () => {
    const store = createGraphStore([makeFileNode("node-a"), makeOperationNode("node-b", 260, 0)]);

    store.getState().composeNodes(["node-a", "node-b"], { id: "compound-1" });
    store.getState().pushDrillStack("compound-1");
    store.getState().handleConnect({
      source: "node-a",
      sourceHandle: null,
      target: "node-b",
      targetHandle: null,
    });

    expect(store.getState().edges).toEqual([]);
    expect(store.getState().getVisibleGraph().edges).toEqual([
      expect.objectContaining({ source: "node-a", target: "node-b" }),
    ]);
  });

  it("ungroups a compound node and restores internal and boundary edges", () => {
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

    store.getState().composeNodes(["node-a", "node-b"], { id: "compound-1" });
    store.getState().pushDrillStack("compound-1");
    store.getState().ungroupCompound("compound-1");

    expect(store.getState().drillStack).toEqual([]);
    expect(store.getState().nodes.map((node) => node.id)).toEqual([
      "outside-in",
      "node-a",
      "node-b",
      "outside-out",
    ]);
    expect(store.getState().nodes.every((node) => node.parentId === undefined)).toBe(true);
    expect(store.getState().edges).toEqual([
      expect.objectContaining({ id: "edge-internal", source: "node-a", target: "node-b" }),
      expect.objectContaining({ id: "edge-in", source: "outside-in", target: "node-a" }),
      expect.objectContaining({ id: "edge-out", source: "node-b", target: "outside-out" }),
    ]);
  });

  it("does not restore a deleted rewired boundary edge when ungrouping", () => {
    const store = createGraphStore(
      [makeFileNode("outside", -240, 0), makeFileNode("node-a"), makeFileNode("node-b", 260, 0)],
      [makeEdge("edge-boundary", "outside", "node-a"), makeEdge("edge-child", "node-a", "node-b")],
    );

    store.getState().composeNodes(["node-a", "node-b"], { id: "compound-1" });
    store.getState().deleteEdge("e-outside-compound-1-edge-boundary");
    store.getState().ungroupCompound("compound-1");

    expect(store.getState().edges.map((edge) => edge.id)).toEqual(["edge-child"]);
  });

  it("syncs xyflow edge removals into compound metadata", () => {
    const store = createGraphStore(
      [makeFileNode("outside", -240, 0), makeFileNode("node-a"), makeFileNode("node-b", 260, 0)],
      [makeEdge("edge-boundary", "outside", "node-a"), makeEdge("edge-child", "node-a", "node-b")],
    );

    store.getState().composeNodes(["node-a", "node-b"], { id: "compound-1" });
    store
      .getState()
      .handleEdgesChange([{ id: "e-outside-compound-1-edge-boundary", type: "remove" }]);
    store.getState().ungroupCompound("compound-1");

    expect(store.getState().edges.map((edge) => edge.id)).toEqual(["edge-child"]);
  });

  it("restores compound children and their edges when deleting the compound", () => {
    const store = createGraphStore(
      [makeFileNode("outside", -240, 0), makeFileNode("node-a"), makeFileNode("node-b", 260, 0)],
      [makeEdge("edge-boundary", "outside", "node-a"), makeEdge("edge-child", "node-a", "node-b")],
    );

    store.getState().composeNodes(["node-a", "node-b"], { id: "compound-1" });
    store.getState().deleteNode("compound-1");

    expect(store.getState().nodes.every((node) => node.parentId === undefined)).toBe(true);
    expect(store.getState().nodes.find((node) => node.id === "node-a")?.position).toEqual({
      x: 0,
      y: 0,
    });
    expect(store.getState().edges.map((edge) => edge.id)).toEqual(["edge-child", "edge-boundary"]);
  });

  it("routes xyflow compound removals through compound cleanup", () => {
    const store = createGraphStore(
      [makeFileNode("outside", -240, 0), makeFileNode("node-a"), makeFileNode("node-b", 260, 0)],
      [makeEdge("edge-boundary", "outside", "node-a"), makeEdge("edge-child", "node-a", "node-b")],
    );

    store.getState().composeNodes(["node-a", "node-b"], { id: "compound-1" });
    store.getState().handleNodesChange([{ id: "compound-1", type: "remove" }]);

    expect(store.getState().nodes.every((node) => node.parentId === undefined)).toBe(true);
    expect(store.getState().edges.map((edge) => edge.id)).toEqual(["edge-child", "edge-boundary"]);
  });

  it("syncs rewired boundary edge edits back to the original edge", () => {
    const store = createGraphStore(
      [makeFileNode("outside", -240, 0), makeFileNode("node-a"), makeFileNode("node-b", 260, 0)],
      [makeEdge("edge-boundary", "outside", "node-a")],
    );

    store.getState().composeNodes(["node-a", "node-b"], { id: "compound-1" });
    store
      .getState()
      .updateEdgeData("e-outside-compound-1-edge-boundary", { label: "Updated boundary" });
    store.getState().ungroupCompound("compound-1");

    expect(store.getState().edges).toEqual([
      expect.objectContaining({ id: "edge-boundary", data: { label: "Updated boundary" } }),
    ]);
  });

  it("restores compound children while respecting other selected deletions", () => {
    const store = createGraphStore(
      [makeFileNode("outside", -240, 0), makeFileNode("node-a"), makeFileNode("node-b", 260, 0)],
      [makeEdge("edge-boundary", "outside", "node-a"), makeEdge("edge-child", "node-a", "node-b")],
    );

    store.getState().composeNodes(["node-a", "node-b"], { id: "compound-1" });
    store.getState().deleteSelected(["compound-1", "node-a"]);

    expect(store.getState().nodes.map((node) => node.id)).toEqual(["outside", "node-b"]);
    expect(store.getState().nodes.find((node) => node.id === "node-b")?.parentId).toBeUndefined();
    expect(store.getState().edges).toEqual([]);
  });

  it("does not restore a selected rewired edge when deleting its compound", () => {
    const store = createGraphStore(
      [makeFileNode("outside", -240, 0), makeFileNode("node-a"), makeFileNode("node-b", 260, 0)],
      [makeEdge("edge-boundary", "outside", "node-a"), makeEdge("edge-child", "node-a", "node-b")],
    );

    store.getState().composeNodes(["node-a", "node-b"], { id: "compound-1" });
    store.getState().deleteSelected(["compound-1", "e-outside-compound-1-edge-boundary"]);

    expect(store.getState().edges.map((edge) => edge.id)).toEqual(["edge-child"]);
  });

  it("removes deleted child references from compound metadata", () => {
    const store = createGraphStore(
      [makeFileNode("outside", -240, 0), makeFileNode("node-a"), makeFileNode("node-b", 260, 0)],
      [makeEdge("edge-boundary", "outside", "node-a"), makeEdge("edge-child", "node-a", "node-b")],
    );

    store.getState().composeNodes(["node-a", "node-b"], { id: "compound-1" });
    store.getState().deleteNode("node-a");

    const compound = store.getState().nodes.find((node) => node.id === "compound-1");
    const data = compound?.data as CompoundNodeData | undefined;
    expect(data?.childNodeIds).toEqual(["node-b"]);
    expect(data?.childEdges).toEqual([]);
    expect(data?.boundaryEdges).toEqual([]);
    expect(store.getState().edges).toEqual([]);
  });

  it("removes rewired edges when compound children are deleted consecutively", () => {
    const store = createGraphStore(
      [
        makeFileNode("outside", -240, 0),
        makeFileNode("node-a"),
        makeFileNode("node-b", 260, 0),
        makeFileNode("node-c", 520, 0),
      ],
      [makeEdge("edge-a", "outside", "node-a"), makeEdge("edge-b", "outside", "node-b")],
    );

    store.getState().composeNodes(["node-a", "node-b", "node-c"], { id: "compound-1" });
    store.getState().deleteNode("node-a");
    store.getState().deleteNode("node-b");

    expect(store.getState().edges).toEqual([]);
  });

  it("does not duplicate compound nodes or recompose existing children", () => {
    const store = createGraphStore(
      [makeFileNode("node-a"), makeFileNode("node-b", 260, 0), makeFileNode("node-c", 520, 0)],
      [],
    );

    store.getState().composeNodes(["node-a", "node-b"], { id: "compound-1" });

    expect(store.getState().duplicateNode("compound-1", "compound-copy")).toBeNull();
    expect(store.getState().composeNodes(["node-a", "node-c"], { id: "compound-2" })).toBeNull();
  });

  it("rejects a mixed compose selection containing an existing compound child", () => {
    const store = createGraphStore(
      [
        makeFileNode("node-a"),
        makeFileNode("node-b", 260, 0),
        makeFileNode("node-c", 520, 0),
        makeFileNode("node-d", 780, 0),
      ],
      [],
    );

    store.getState().composeNodes(["node-a", "node-b"], { id: "compound-1" });
    expect(
      store.getState().composeNodes(["node-a", "node-c", "node-d"], { id: "compound-2" }),
    ).toBeNull();
    expect(store.getState().nodes.find((node) => node.id === "node-a")?.parentId).toBe(
      "compound-1",
    );
    expect(store.getState().nodes.some((node) => node.id === "compound-2")).toBe(false);
  });
});
