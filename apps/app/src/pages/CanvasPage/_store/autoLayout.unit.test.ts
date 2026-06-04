import { describe, it, expect } from "vitest";
import { computeAutoLayout } from "./autoLayout";
import type { PipelineNode, PipelineEdge } from "./canvasSlice";

const makeNode = (id: string, x = 0, y = 0, w = 280, h = 120): PipelineNode =>
  ({
    id,
    type: "operation",
    position: { x, y },
    measured: { width: w, height: h },
    data: {
      label: id,
      nodeType: "operation",
      operationId: "",
      operationName: "",
      status: "idle",
    },
  }) as PipelineNode;

const makeEdge = (source: string, target: string): PipelineEdge =>
  ({ id: `${source}-${target}`, source, target }) as PipelineEdge;

const makeCompoundNode = (
  id: string,
  childNodeIds: string[],
  x = 0,
  y = 0,
  w = 280,
  h = 120,
): PipelineNode =>
  ({
    id,
    type: "compound",
    position: { x, y },
    measured: { width: w, height: h },
    data: {
      label: id,
      nodeType: "compound",
      childNodeIds,
    },
  }) as PipelineNode;

const positionById = (nodes: PipelineNode[]) =>
  Object.fromEntries(nodes.map((node) => [node.id, node.position]));

const nodeById = (nodes: PipelineNode[]) =>
  Object.fromEntries(nodes.map((node) => [node.id, node]));

describe("computeAutoLayout", () => {
  it("returns empty array for no nodes", async () => {
    await expect(computeAutoLayout([], [])).resolves.toEqual([]);
  });

  it("places a single node at the normalized origin", async () => {
    const nodes = [makeNode("a", 500, 500)];
    const result = await computeAutoLayout(nodes, []);

    expect(result[0].position).toEqual({ x: 0, y: 0 });
  });

  it("places a linear chain left-to-right on the same row", async () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
    const result = await computeAutoLayout(nodes, edges);
    const pos = positionById(result);

    expect(pos.a.x).toBeLessThan(pos.b.x);
    expect(pos.b.x).toBeLessThan(pos.c.x);
    expect(pos.a.y).toBe(pos.b.y);
    expect(pos.b.y).toBe(pos.c.y);
  });

  it("places parallel branches in the next layer without overlapping", async () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges = [makeEdge("a", "b"), makeEdge("a", "c")];
    const result = await computeAutoLayout(nodes, edges);
    const pos = positionById(result);

    expect(pos.a.x).toBeLessThan(pos.b.x);
    expect(pos.a.x).toBeLessThan(pos.c.x);
    expect(pos.b.x).toBe(pos.c.x);
    expect(pos.b.y).not.toBe(pos.c.y);
  });

  it("preserves node ids and data", async () => {
    const nodes = [makeNode("x"), makeNode("y")];
    const edges = [makeEdge("x", "y")];
    const result = await computeAutoLayout(nodes, edges);

    expect(result.map((node) => node.id)).toEqual(["x", "y"]);
    expect(result[0].data.label).toBe("x");
  });

  it("separates chain nodes by at least their measured width", async () => {
    const a = makeNode("a", 0, 0, 200, 100);
    const b = makeNode("b", 0, 0, 300, 100);
    const edges = [makeEdge("a", "b")];
    const result = await computeAutoLayout([a, b], edges);
    const pos = positionById(result);

    expect(pos.b.x).toBeGreaterThanOrEqual(pos.a.x + 200);
  });

  it("places multiple predecessors before their shared target", async () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c"), makeNode("d"), makeNode("e")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c"), makeEdge("d", "b"), makeEdge("e", "b")];
    const result = await computeAutoLayout(nodes, edges);
    const pos = positionById(result);

    expect(pos.a.x).toBeLessThan(pos.b.x);
    expect(pos.d.x).toBeLessThan(pos.b.x);
    expect(pos.e.x).toBeLessThan(pos.b.x);
    expect(pos.b.x).toBeLessThan(pos.c.x);
    expect(new Set([pos.a.y, pos.d.y, pos.e.y]).size).toBe(3);
  });

  it("keeps diamond branches in the same intermediate layer", async () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c"), makeNode("d")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "d"), makeEdge("a", "c"), makeEdge("c", "d")];
    const result = await computeAutoLayout(nodes, edges);
    const pos = positionById(result);

    expect(pos.a.x).toBeLessThan(pos.b.x);
    expect(pos.a.x).toBeLessThan(pos.c.x);
    expect(pos.b.x).toBe(pos.c.x);
    expect(pos.b.y).not.toBe(pos.c.y);
    expect(pos.b.x).toBeLessThan(pos.d.x);
    expect(pos.c.x).toBeLessThan(pos.d.x);
  });

  it("positions compound children relative to the compound parent", async () => {
    const g = makeCompoundNode("g", ["b", "c"]);
    const b = makeNode("b");
    const c = makeNode("c");
    const a = makeNode("a");
    const d = makeNode("d");
    const edges = [makeEdge("a", "g"), makeEdge("g", "d"), makeEdge("b", "c")];

    const result = await computeAutoLayout([a, g, b, c, d], edges);
    const pos = positionById(result);
    const nodesById = nodeById(result);

    expect(pos.a.x).toBeLessThan(pos.g.x);
    expect(pos.g.x).toBeLessThan(pos.d.x);
    expect(nodesById.b.parentId).toBe("g");
    expect(nodesById.c.parentId).toBe("g");
    expect(pos.b.x).toBeGreaterThanOrEqual(0);
    expect(pos.b.y).toBeGreaterThanOrEqual(0);
    expect(pos.b.x).toBeLessThan(pos.c.x);
  });

  it("expands compound nodes to fit ELK-positioned children", async () => {
    const g = makeCompoundNode("g", ["b", "c"]);
    const b = makeNode("b");
    const c = makeNode("c");
    const result = await computeAutoLayout([g, b, c], [makeEdge("b", "c")]);
    const nodesById = nodeById(result);

    expect(nodesById.g.style?.width).toBeGreaterThanOrEqual(2 * 280 + 80 + 2 * 40);
    expect(nodesById.g.style?.height).toBeGreaterThanOrEqual(120 + 2 * 40);
  });

  it("uses the expanded compound width when laying out top-level successors", async () => {
    const a = makeNode("a");
    const g = makeCompoundNode("g", ["b", "c"]);
    const b = makeNode("b");
    const c = makeNode("c");
    const d = makeNode("d");
    const result = await computeAutoLayout(
      [a, g, b, c, d],
      [makeEdge("a", "g"), makeEdge("g", "d"), makeEdge("b", "c")],
    );
    const pos = positionById(result);
    const nodesById = nodeById(result);
    const gWidth = (nodesById.g.style?.width as number) ?? 0;

    expect(pos.d.x).toBeGreaterThanOrEqual(pos.g.x + gWidth);
  });
});
