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
  it("returns empty array for no nodes", async () => {
    expect(await computeAutoLayout([], [])).toEqual([]);
  });

  it("places a single node at a defined position", async () => {
    const nodes = [makeNode("a", 500, 500)];
    const result = await computeAutoLayout(nodes, []);
    expect(typeof result[0].position.x).toBe("number");
    expect(typeof result[0].position.y).toBe("number");
  });

  it("linear chain: A → B → C placed left-to-right", async () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges = [makeEdge("a", "b"), makeEdge("b", "c")];
    const result = await computeAutoLayout(nodes, edges);

    expect(result[0].position.x).toBeLessThan(result[1].position.x);
    expect(result[1].position.x).toBeLessThan(result[2].position.x);
  });

  it("parallel branches: A → B, A → C places B and C in same rank", async () => {
    const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
    const edges = [makeEdge("a", "b"), makeEdge("a", "c")];
    const result = await computeAutoLayout(nodes, edges);

    const bPos = result.find((n) => n.id === "b")!.position;
    const cPos = result.find((n) => n.id === "c")!.position;

    // Same horizontal rank (same x)
    expect(bPos.x).toBe(cPos.x);
    // Different vertical positions
    expect(bPos.y).not.toBe(cPos.y);
  });

  it("preserves node ids and data", async () => {
    const nodes = [makeNode("x"), makeNode("y")];
    const edges = [makeEdge("x", "y")];
    const result = await computeAutoLayout(nodes, edges);
    expect(result.map((n) => n.id)).toEqual(["x", "y"]);
    expect(result[0].data.label).toBe("x");
  });

  it("nodes do not overlap horizontally in a chain", async () => {
    const a = makeNode("a", 0, 0, 200, 100);
    const b = makeNode("b", 0, 0, 300, 100);
    const edges = [makeEdge("a", "b")];
    const result = await computeAutoLayout([a, b], edges);
    const aRight = result[0].position.x + 200;
    const bLeft = result[1].position.x;
    expect(bLeft).toBeGreaterThanOrEqual(aRight);
  });

  it("nodes do not overlap vertically in parallel branches", async () => {
    const nodes = [
      makeNode("a", 0, 0, 280, 100),
      makeNode("b", 0, 0, 280, 80),
      makeNode("c", 0, 0, 280, 80),
    ];
    const edges = [makeEdge("a", "b"), makeEdge("a", "c")];
    const result = await computeAutoLayout(nodes, edges);
    const bPos = result.find((n) => n.id === "b")!;
    const cPos = result.find((n) => n.id === "c")!;
    const upper = bPos.position.y < cPos.position.y ? bPos : cPos;
    const lower = bPos.position.y < cPos.position.y ? cPos : bPos;
    const upperHeight = upper.measured?.height ?? 120;
    expect(lower.position.y).toBeGreaterThanOrEqual(
      upper.position.y + upperHeight,
    );
  });

  it("loop pipeline: handles back-edge cycle via elkjs", async () => {
    const loopNode = {
      id: "n_loop",
      type: "loop" as const,
      position: { x: 0, y: 0 },
      measured: { width: 280, height: 200 },
      data: {
        label: "Loop",
        nodeType: "loop",
        childNodeIds: ["n_fix", "n_output", "n_recheck"],
        maxIterations: 3,
        passCondition: { field: "stats.errors", operator: "eq", value: 0 },
      },
    } as PipelineNode;

    const nodes: PipelineNode[] = [
      makeNode("n_project"),
      makeNode("n_check"),
      loopNode,
      makeNode("n_fix"),
      makeNode("n_output"),
      makeNode("n_recheck"),
      makeNode("n_report"),
    ];
    const edges: PipelineEdge[] = [
      makeEdge("n_project", "n_check"),
      makeEdge("n_check", "n_loop"),
      makeEdge("n_loop", "n_fix"),
      makeEdge("n_fix", "n_output"),
      makeEdge("n_output", "n_recheck"),
      makeEdge("n_recheck", "n_loop"), // back-edge
      makeEdge("n_loop", "n_report"),
    ];
    const result = await computeAutoLayout(nodes, edges);

    const pos = Object.fromEntries(result.map((n) => [n.id, n.position]));

    // All nodes get valid positions (dagre doesn't crash on cycles)
    for (const id of [
      "n_project",
      "n_check",
      "n_loop",
      "n_fix",
      "n_output",
      "n_recheck",
      "n_report",
    ]) {
      expect(typeof pos[id].x).toBe("number");
      expect(typeof pos[id].y).toBe("number");
      expect(Number.isFinite(pos[id].x)).toBe(true);
      expect(Number.isFinite(pos[id].y)).toBe(true);
    }

    // General flow: project is leftmost
    expect(pos.n_project.x).toBeLessThan(pos.n_check.x);
  });

  it("pipe_loop_fix_i18n: layout with real measured dimensions", async () => {
    const nodes: PipelineNode[] = [
      {
        id: "n_project",
        type: "github-project" as const,
        position: { x: 0, y: 0 },
        measured: { width: 1020, height: 310 },
        data: { label: "GitHub Project", nodeType: "github-project" },
      } as PipelineNode,
      {
        id: "n_initial_check",
        type: "operation" as const,
        position: { x: 0, y: 0 },
        measured: { width: 131, height: 234 },
        data: { label: "Initial Check", nodeType: "operation" },
      } as PipelineNode,
      {
        id: "n_loop",
        type: "loop" as const,
        position: { x: 0, y: 0 },
        measured: { width: 311, height: 217 },
        data: {
          label: "Loop",
          nodeType: "loop",
          childNodeIds: ["n_fix", "n_project_output", "n_recheck"],
          maxIterations: 3,
          passCondition: { field: "stats.errors", operator: "eq", value: 0 },
        },
      } as PipelineNode,
      {
        id: "n_fix",
        type: "operation" as const,
        position: { x: 0, y: 0 },
        measured: { width: 131, height: 234 },
        data: { label: "Fix i18n", nodeType: "operation" },
      } as PipelineNode,
      {
        id: "n_project_output",
        type: "output-project-path" as const,
        position: { x: 0, y: 0 },
        measured: { width: 257, height: 172 },
        data: { label: "Project Output", nodeType: "output-project-path" },
      } as PipelineNode,
      {
        id: "n_recheck",
        type: "operation" as const,
        position: { x: 0, y: 0 },
        measured: { width: 131, height: 234 },
        data: { label: "Recheck", nodeType: "operation" },
      } as PipelineNode,
      {
        id: "n_final_report",
        type: "output-local-path" as const,
        position: { x: 0, y: 0 },
        measured: { width: 224, height: 218 },
        data: { label: "Final Report", nodeType: "output-local-path" },
      } as PipelineNode,
    ];

    const edges: PipelineEdge[] = [
      makeEdge("n_project", "n_initial_check"),
      makeEdge("n_initial_check", "n_loop"),
      makeEdge("n_loop", "n_fix"),
      makeEdge("n_fix", "n_project_output"),
      makeEdge("n_project_output", "n_recheck"),
      makeEdge("n_recheck", "n_loop"), // back-edge
      makeEdge("n_loop", "n_final_report"),
    ];

    const result = await computeAutoLayout(nodes, edges);
    const pos = Object.fromEntries(result.map((n) => [n.id, n.position]));

    // Flow is left-to-right: project → check → loop → ... → report
    expect(pos.n_project.x).toBeLessThan(pos.n_initial_check.x);
    expect(pos.n_initial_check.x).toBeLessThan(pos.n_loop.x);

    // Loop children start at or after the loop node's x
    expect(pos.n_fix.x).toBeGreaterThanOrEqual(pos.n_loop.x);
    expect(pos.n_project_output.x).toBeGreaterThan(pos.n_fix.x);
    expect(pos.n_recheck.x).toBeGreaterThan(pos.n_project_output.x);

    // No node overlaps: check all pairs don't share the same bounding box
    const allNodes = result;
    for (let i = 0; i < allNodes.length; i++) {
      for (let j = i + 1; j < allNodes.length; j++) {
        const a = allNodes[i];
        const b = allNodes[j];
        const aw = a.measured?.width ?? 280;
        const ah = a.measured?.height ?? 120;
        const bw = b.measured?.width ?? 280;
        const bh = b.measured?.height ?? 120;
        const xOverlap =
          a.position.x < b.position.x + bw && b.position.x < a.position.x + aw;
        const yOverlap =
          a.position.y < b.position.y + bh && b.position.y < a.position.y + ah;
        expect(xOverlap && yOverlap, `Nodes ${a.id} and ${b.id} overlap`).toBe(
          false,
        );
      }
    }
  });

  it("nested loops: outer loop A contains inner loop B with child C", async () => {
    const innerLoop = {
      id: "loop_b",
      type: "loop" as const,
      position: { x: 0, y: 0 },
      measured: { width: 280, height: 150 },
      data: {
        label: "Inner Loop",
        nodeType: "loop",
        childNodeIds: ["c1", "c2"],
        maxIterations: 2,
        passCondition: { field: "ok", operator: "eq", value: 1 },
      },
    } as PipelineNode;

    const outerLoop = {
      id: "loop_a",
      type: "loop" as const,
      position: { x: 0, y: 0 },
      measured: { width: 300, height: 180 },
      data: {
        label: "Outer Loop",
        nodeType: "loop",
        childNodeIds: ["pre", "loop_b", "post"],
        maxIterations: 3,
        passCondition: { field: "done", operator: "eq", value: 1 },
      },
    } as PipelineNode;

    const nodes: PipelineNode[] = [
      makeNode("start"),
      outerLoop,
      makeNode("pre"),
      innerLoop,
      makeNode("c1"),
      makeNode("c2"),
      makeNode("post"),
      makeNode("end"),
    ];

    const edges: PipelineEdge[] = [
      makeEdge("start", "loop_a"),
      makeEdge("pre", "loop_b"),
      makeEdge("c1", "c2"),
      makeEdge("loop_b", "post"),
      makeEdge("loop_a", "end"),
    ];

    const result = await computeAutoLayout(nodes, edges);
    const pos = Object.fromEntries(result.map((n) => [n.id, n.position]));

    // All nodes have valid finite positions
    for (const id of [
      "start",
      "loop_a",
      "pre",
      "loop_b",
      "c1",
      "c2",
      "post",
      "end",
    ]) {
      expect(Number.isFinite(pos[id].x), `${id}.x is finite`).toBe(true);
      expect(Number.isFinite(pos[id].y), `${id}.y is finite`).toBe(true);
    }

    // Flow: start → loop_a → end
    expect(pos.start.x).toBeLessThan(pos.loop_a.x);
    expect(pos.loop_a.x).toBeLessThan(pos.end.x);

    // Outer loop children within loop_a bounds
    expect(pos.pre.x).toBeGreaterThanOrEqual(pos.loop_a.x);
    expect(pos.post.x).toBeGreaterThanOrEqual(pos.loop_a.x);

    // Inner loop children within loop_b bounds
    expect(pos.c1.x).toBeGreaterThanOrEqual(pos.loop_b.x);
    expect(pos.c2.x).toBeGreaterThanOrEqual(pos.loop_b.x);

    // c1 → c2 left to right
    expect(pos.c1.x).toBeLessThan(pos.c2.x);
  });

  it("cross-loop edge: child → outside is lifted to loop level", async () => {
    const loopNode = {
      id: "loop",
      type: "loop" as const,
      position: { x: 0, y: 0 },
      measured: { width: 280, height: 150 },
      data: {
        label: "Loop",
        nodeType: "loop",
        childNodeIds: ["c_a"],
        maxIterations: 1,
        passCondition: { field: "x", operator: "eq", value: 0 },
      },
    } as PipelineNode;

    const nodes: PipelineNode[] = [
      makeNode("before"),
      loopNode,
      makeNode("c_a"),
      makeNode("after"),
    ];

    // c_a → after is a cross-boundary edge (child → outside)
    const edges: PipelineEdge[] = [
      makeEdge("before", "loop"),
      makeEdge("c_a", "after"),
    ];

    const result = await computeAutoLayout(nodes, edges);
    const pos = Object.fromEntries(result.map((n) => [n.id, n.position]));

    // All positions valid
    for (const id of ["before", "loop", "c_a", "after"]) {
      expect(Number.isFinite(pos[id].x), `${id}.x is finite`).toBe(true);
    }

    // Flow preserved: before → loop → after
    expect(pos.before.x).toBeLessThan(pos.loop.x);
    expect(pos.loop.x).toBeLessThan(pos.after.x);
  });
});
