import { describe, it, expect, beforeEach } from "vitest";
import { createCanvasPageStore } from "./canvasPageStore";
import type { PipelineNode, PipelineEdge } from "./canvasSlice";

const makeNode = (id: string): PipelineNode => ({
  id,
  type: "file",
  position: { x: 0, y: 0 },
  data: { label: id, nodeType: "file", filePath: "" },
});

const makeChildNode = (id: string, parentId: string): PipelineNode => ({
  ...makeNode(id),
  parentId,
  extent: "parent",
});

const makeEdge = (id: string): PipelineEdge =>
  ({
    id,
    source: "a",
    target: "b",
    type: "default",
    animated: true,
    data: {},
  }) as unknown as PipelineEdge;

describe("importCanvas store action", () => {
  const ctx = { store: null as ReturnType<typeof createCanvasPageStore> | null };

  beforeEach(() => {
    ctx.store = createCanvasPageStore([], [], null, "");
  });

  it("sets nodes and edges from imported data", () => {
    const importedNodes = [makeNode("n1"), makeNode("n2")];
    const importedEdges = [makeEdge("e1")];

    ctx.store!.getState().importCanvas({ nodes: importedNodes, edges: importedEdges });

    expect(ctx.store!.getState().nodes).toEqual(importedNodes);
    expect(ctx.store!.getState().edges).toEqual(importedEdges);
  });

  it("updates pipeline name from imported name", () => {
    const importedNodes = [makeNode("n1")];
    const importedEdges = [makeEdge("e1")];

    ctx.store!.getState().importCanvas({
      name: "Imported Pipeline",
      nodes: importedNodes,
      edges: importedEdges,
    });

    expect(ctx.store!.getState().pipelineName).toBe("Imported Pipeline");
  });

  it("uses imported title when name is absent", () => {
    const importedNodes = [makeNode("n1")];

    ctx.store!.getState().importCanvas({
      title: "Legacy Title",
      nodes: importedNodes,
      edges: [],
    });

    expect(ctx.store!.getState().pipelineName).toBe("Legacy Title");
  });

  it("replaces existing canvas content", () => {
    const initialNode = makeNode("old");
    ctx.store = createCanvasPageStore([initialNode], [], null, "");
    expect(ctx.store.getState().nodes).toHaveLength(1);

    ctx.store.getState().importCanvas({ nodes: [], edges: [] });

    expect(ctx.store.getState().nodes).toHaveLength(0);
  });

  it("sorts imported parent nodes before child nodes", () => {
    const parentNode = makeNode("parent");
    const childNode = makeChildNode("child", "parent");

    ctx.store!.getState().importCanvas({ nodes: [childNode, parentNode], edges: [] });

    expect(ctx.store!.getState().nodes.map((node) => node.id)).toEqual(["parent", "child"]);
  });

  it("clears stale undo and redo history after import", () => {
    const importedNode = makeNode("imported");

    ctx.store!.getState().addNode(makeNode("old"));
    expect(ctx.store!.getState().canUndo).toBe(true);

    ctx.store!.getState().importCanvas({ nodes: [importedNode], edges: [] });

    expect(ctx.store!.getState().canUndo).toBe(false);
    expect(ctx.store!.getState().canRedo).toBe(false);
    expect(ctx.store!.getState()._history).toEqual([]);
    expect(ctx.store!.getState()._future).toEqual([]);
    ctx.store!.getState().handleUndo();
    expect(ctx.store!.getState().nodes).toEqual([importedNode]);
  });
});
