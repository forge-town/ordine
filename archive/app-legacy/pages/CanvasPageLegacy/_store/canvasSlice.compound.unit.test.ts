import { describe, expect, it } from "vitest";
import type { CompoundNodeData } from "@repo/schemas";
import { createCanvasPageStore } from "./canvasPageStore";
import type { PipelineEdge, PipelineNode } from "./canvasSlice";

const makeNode = (id: string, position: PipelineNode["position"], selected = false): PipelineNode =>
  ({
    id,
    position,
    selected,
    type: "operation",
    data: {
      label: id,
      nodeType: "operation",
      operationId: id,
      operationName: id,
    },
  }) as PipelineNode;

const makeEdge = (id: string, source: string, target: string): PipelineEdge =>
  ({
    id,
    animated: true,
    source,
    target,
    type: "semantic",
    data: { label: id },
  }) as PipelineEdge;

describe("compound graph composition", () => {
  it("moves internal edges into childEdges and rewires boundary edges to the compound", () => {
    const store = createCanvasPageStore(
      [
        makeNode("outside-in", { x: -240, y: 0 }),
        makeNode("node-a", { x: 0, y: 0 }, true),
        makeNode("node-b", { x: 260, y: 0 }, true),
        makeNode("outside-out", { x: 560, y: 0 }),
      ],
      [
        makeEdge("edge-in", "outside-in", "node-a"),
        makeEdge("edge-internal", "node-a", "node-b"),
        makeEdge("edge-out", "node-b", "outside-out"),
      ],
    );

    store.getState().groupSelectedNodes(["node-a", "node-b"], "Review pair");

    const state = store.getState();
    const compound = state.nodes.find((node) => node.type === "compound");
    expect(compound).toBeDefined();
    if (!compound) {
      throw new Error("compound node was not created");
    }
    const compoundData = compound.data as CompoundNodeData;

    expect(compoundData.label).toBe("Review pair");
    expect(compoundData.childNodeIds).toEqual(["node-a", "node-b"]);
    expect(compoundData.childEdges).toEqual([
      expect.objectContaining({
        id: "edge-internal",
        source: "node-a",
        target: "node-b",
      }),
    ]);
    expect(state.edges).toEqual([
      expect.objectContaining({
        id: `e-outside-in-${compound?.id}-edge-in`,
        source: "outside-in",
        target: compound?.id,
      }),
      expect.objectContaining({
        id: `e-${compound?.id}-outside-out-edge-out`,
        source: compound?.id,
        target: "outside-out",
      }),
    ]);
    expect(state.nodes.find((node) => node.id === "node-a")?.parentId).toBe(compound?.id);
    expect(state.nodes.find((node) => node.id === "node-b")?.parentId).toBe(compound?.id);
  });
});
