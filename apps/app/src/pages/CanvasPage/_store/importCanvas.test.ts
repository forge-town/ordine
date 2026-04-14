import { describe, it, expect, beforeEach } from "vitest";
import { createHarnessCanvasStore } from "./harnessCanvasStore";
import type { PipelineNode, PipelineEdge } from "./canvasSlice";

const makeNode = (id: string): PipelineNode =>
  ({
    id,
    type: "codeFile",
    position: { x: 0, y: 0 },
    data: { label: id, filePath: "" },
  }) as unknown as PipelineNode;

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
  const ctx = { store: null as ReturnType<typeof createHarnessCanvasStore> | null };

  beforeEach(() => {
    ctx.store = createHarnessCanvasStore([], [], null, "");
  });

  it("sets nodes and edges from imported data", () => {
    const importedNodes = [makeNode("n1"), makeNode("n2")];
    const importedEdges = [makeEdge("e1")];

    ctx.store!.getState().importCanvas({ nodes: importedNodes, edges: importedEdges });

    expect(ctx.store!.getState().nodes).toEqual(importedNodes);
    expect(ctx.store!.getState().edges).toEqual(importedEdges);
  });

  it("replaces existing canvas content", () => {
    const initialNode = makeNode("old");
    ctx.store = createHarnessCanvasStore([initialNode], [], null, "");
    expect(ctx.store.getState().nodes).toHaveLength(1);

    ctx.store.getState().importCanvas({ nodes: [], edges: [] });

    expect(ctx.store.getState().nodes).toHaveLength(0);
  });
});
