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

describe("computeAutoLayout", () => {
  it("returns empty array for no nodes", () => {
    expect(computeAutoLayout([], [])).toEqual([]);
  });

  it("places a single node at a defined position", () => {
    const nodes = [makeNode("a", 500, 500)];
    const result = computeAutoLayout(nodes, []);
    expect(typeof result[0].position.x).toBe("number");
    expect(typeof result[0].position.y).toBe("number");
  });

  it("linear chain: A → B → C placed left-to-right on same Y", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
    const result = computeAutoLayout(nodes, edges);

    expect(result[0].position.x).toBeLessThan(result[1].position.x);
    expect(result[1].position.x).toBeLessThan(result[2].position.x);

    // Trunk is a straight line — all at Y=0
    expect(result[0].position.y).toBe(0);
    expect(result[1].position.y).toBe(0);
    expect(result[2].position.y).toBe(0);
  });

  it("parallel branches: A → B, A → C are sequentially placed", () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges = [makeEdge("a", "b"), makeEdge("a", "c")];
    const result = computeAutoLayout(nodes, edges);

    // All on trunk — all at same Y (straight line)
    expect(result[0].position.y).toBe(result[1].position.y);
    // A is leftmost
    expect(result[0].position.x).toBeLessThan(result[1].position.x);
  });

  it("preserves node ids and data", () => {
    const nodes = [makeNode("x"), makeNode("y")];
    const edges = [makeEdge("x", "y")];
    const result = computeAutoLayout(nodes, edges);
    expect(result.map((n) => n.id)).toEqual(["x", "y"]);
    expect(result[0].data.label).toBe("x");
  });

  it("nodes do not overlap horizontally in a chain", () => {
    const a = makeNode("a", 0, 0, 200, 100);
    const b = makeNode("b", 0, 0, 300, 100);
    const edges = [makeEdge("a", "b")];
    const result = computeAutoLayout([a, b], edges);
    const aRight = result[0].position.x + 200;
    const bLeft = result[1].position.x;
    expect(bLeft).toBeGreaterThanOrEqual(aRight);
  });

  it("side input: extra predecessor stacked above main path", () => {
    // A → B → C (main path), D → B (side input)
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c"), makeNode("d")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c"), makeEdge("d", "b")];
    const result = computeAutoLayout(nodes, edges);
    const pos = Object.fromEntries(result.map((n) => [n.id, n.position]));

    // Main path: A → B → C at Y=0
    expect(pos.a.y).toBe(0);
    expect(pos.b.y).toBe(0);
    expect(pos.c.y).toBe(0);
    expect(pos.a.x).toBeLessThan(pos.b.x);
    expect(pos.b.x).toBeLessThan(pos.c.x);

    // D is stacked above B (negative Y)
    expect(pos.d.y).toBeLessThan(0);
    // D is at B's X column
    expect(pos.d.x).toBe(pos.b.x);
  });

  it("diamond: one branch becomes side, stacked above anchor", () => {
    // A → B → D, A → C → D
    // Main path = A → B → D (tie-break), C is side above D
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c"), makeNode("d")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "d"), makeEdge("a", "c"), makeEdge("c", "d")];
    const result = computeAutoLayout(nodes, edges);
    const pos = Object.fromEntries(result.map((n) => [n.id, n.position]));

    // Main path at Y=0
    expect(pos.a.y).toBe(0);

    // The side node (C) should be above main path
    // One of B or C is side — the other is on main path
    const mainY = 0;
    const sideNode = pos.b.y < 0 ? "b" : pos.c.y < 0 ? "c" : null;
    expect(sideNode).not.toBeNull();
    // The side node is above (negative Y)
    expect(pos[sideNode!].y).toBeLessThan(mainY);
  });

  it("multiple side inputs: fishbone alternating above/below", () => {
    // A → B → C (main path), D → B, E → B (two side inputs)
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c"), makeNode("d"), makeNode("e")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c"), makeEdge("d", "b"), makeEdge("e", "b")];
    const result = computeAutoLayout(nodes, edges);
    const pos = Object.fromEntries(result.map((n) => [n.id, n.position]));

    // Main path at Y=0
    expect(pos.a.y).toBe(0);
    expect(pos.b.y).toBe(0);
    expect(pos.c.y).toBe(0);

    // Fishbone: first input above (Y<0), second input below (Y>0)
    expect(pos.d.y).toBeLessThan(0);
    expect(pos.e.y).toBeGreaterThan(0);

    // Both ribs at same X column (B's X)
    expect(pos.d.x).toBe(pos.b.x);
    expect(pos.e.x).toBe(pos.b.x);

    // D and E don't overlap vertically (one above, one below spine)
    const dBottom = pos.d.y + 120;
    const eTop = pos.e.y;
    expect(dBottom).toBeLessThanOrEqual(eTop);
  });

  // ── Compound node tests ───────────────────────────────────────────────────

  const makeCompoundNode = (
    id: string,
    childNodeIds: string[],
    x = 0,
    y = 0,
    w = 280,
    h = 120
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

  it("compound node with children: children positioned inside compound", () => {
    // A → [compound G contains B, C] → D
    const g = makeCompoundNode("g", ["b", "c"]);
    const b = makeNode("b");
    const c = makeNode("c");
    const a = makeNode("a");
    const d = makeNode("d");

    const edges = [
      makeEdge("a", "g"),
      makeEdge("g", "d"),
      makeEdge("b", "c"), // internal edge inside compound
    ];

    const result = computeAutoLayout([a, g, b, c, d], edges);
    const pos = Object.fromEntries(result.map((n) => [n.id, n.position]));

    // Main path: A → G → D at Y=0
    expect(pos.a.y).toBe(0);
    expect(pos.g.y).toBe(0);
    expect(pos.d.y).toBe(0);
    expect(pos.a.x).toBeLessThan(pos.g.x);
    expect(pos.g.x).toBeLessThan(pos.d.x);

    // Children B and C are positioned relative to compound G
    // (parentId-based: positions relative to G's top-left)
    const resultNodes = Object.fromEntries(result.map((n) => [n.id, n]));
    expect(resultNodes.b.parentId).toBe("g");
    expect(resultNodes.c.parentId).toBe("g");

    // Children have positive relative positions (inside the container)
    expect(pos.b.x).toBeGreaterThanOrEqual(0);
    expect(pos.b.y).toBeGreaterThanOrEqual(0);
    expect(pos.c.x).toBeGreaterThanOrEqual(0);
    expect(pos.c.y).toBeGreaterThanOrEqual(0);
  });

  it("compound node expands to fit children", () => {
    // Compound G contains B and C in a chain
    const g = makeCompoundNode("g", ["b", "c"]);
    const b = makeNode("b");
    const c = makeNode("c");

    const edges = [makeEdge("b", "c")]; // internal chain

    const result = computeAutoLayout([g, b, c], edges);
    const resultNodes = Object.fromEntries(result.map((n) => [n.id, n]));

    // Compound node should have style.width and style.height set
    expect(resultNodes.g.style?.width).toBeGreaterThan(0);
    expect(resultNodes.g.style?.height).toBeGreaterThan(0);

    // Width should fit two nodes side by side + gaps + padding
    // At minimum: 2 * nodeWidth + gap + 2 * padding
    const minExpectedWidth = 2 * 280 + 80 + 2 * 40; // 2 nodes + gap + padding
    expect(resultNodes.g.style?.width).toBeGreaterThanOrEqual(minExpectedWidth);
  });

  it("compound node on main path takes expanded space", () => {
    // A → [compound G contains B] → C
    const a = makeNode("a");
    const g = makeCompoundNode("g", ["b"]);
    const b = makeNode("b");
    const c = makeNode("c");

    const edges = [makeEdge("a", "g"), makeEdge("g", "c")];

    const result = computeAutoLayout([a, g, b, c], edges);
    const pos = Object.fromEntries(result.map((n) => [n.id, n.position]));

    // A → G → C on main path
    expect(pos.a.x).toBeLessThan(pos.g.x);
    expect(pos.g.x).toBeLessThan(pos.c.x);

    // C should be far enough right to account for G's expanded width
    const resultNodes = Object.fromEntries(result.map((n) => [n.id, n]));
    const gWidth = (resultNodes.g.style?.width as number) ?? 0;
    expect(pos.c.x).toBeGreaterThanOrEqual(pos.g.x + gWidth);
  });
});
