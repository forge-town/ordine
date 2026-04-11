import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode, ElkExtendedEdge } from "elkjs";
import type { PipelineNode, PipelineEdge } from "./canvasSlice";
import type { LoopNodeData } from "../nodeSchemas";

const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 120;
const H_GAP = 80;
const V_GAP = 60;
const COMPOUND_PAD = 20;

const elk = new ELK();

let edgeCounter = 0;

export const computeAutoLayout = async (
  nodes: PipelineNode[],
  edges: PipelineEdge[],
): Promise<PipelineNode[]> => {
  if (nodes.length === 0) return [];
  edgeCounter = 0;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // ── Loop structure (childToLoop maps child → immediate parent loop) ────────
  const loopChildren = new Map<string, string[]>();
  const childToLoop = new Map<string, string>();

  for (const n of nodes) {
    if (n.type === "loop") {
      const children = (n.data as unknown as LoopNodeData).childNodeIds ?? [];
      loopChildren.set(n.id, children);
      for (const c of children) childToLoop.set(c, n.id);
    }
  }

  const getSize = (id: string) => {
    const n = nodeMap.get(id);
    return {
      w: n?.measured?.width ?? DEFAULT_WIDTH,
      h: n?.measured?.height ?? DEFAULT_HEIGHT,
    };
  };

  // ── Ancestor chain helpers ─────────────────────────────────────────────────
  const getAncestorChain = (id: string): string[] => {
    const chain: string[] = [];
    let cur = childToLoop.get(id);
    const visited = new Set<string>();
    while (cur && !visited.has(cur)) {
      chain.push(cur);
      visited.add(cur);
      cur = childToLoop.get(cur);
    }
    return chain;
  };

  // ── Find which level (loop) owns an edge ────────────────────────────────────
  // Returns the loop ID whose children array should contain this edge,
  // or undefined for the root level.
  // Rule: the edge belongs to the deepest loop that is a proper ancestor of BOTH endpoints.
  // If one endpoint IS a direct ancestor of the other, go up to that ancestor's parent.
  const findEdgeOwner = (src: string, tgt: string): string | undefined => {
    const pathA = [src, ...getAncestorChain(src)];
    const pathB = new Set([tgt, ...getAncestorChain(tgt)]);

    for (const node of pathA) {
      if (pathB.has(node)) {
        if (node === src || node === tgt) {
          return childToLoop.get(node);
        }
        return node;
      }
    }
    return undefined;
  };

  // ── Resolve endpoint: lift child id to direct child of `targetParent` ──────
  const resolveToLevel = (
    id: string,
    targetParent: string | undefined,
  ): string => {
    let cur = id;
    const visited = new Set<string>();
    while (childToLoop.has(cur) && childToLoop.get(cur) !== targetParent) {
      if (visited.has(cur)) break;
      visited.add(cur);
      cur = childToLoop.get(cur)!;
    }
    return cur;
  };

  // ── Recursive ELK node builder ─────────────────────────────────────────────
  const buildElkNode = (id: string): ElkNode => {
    const { w, h } = getSize(id);

    if (!loopChildren.has(id)) {
      return { id, width: w, height: h };
    }

    const directChildren = loopChildren.get(id)!;
    const elkChildren = directChildren.map(buildElkNode);

    const elkEdges: ElkExtendedEdge[] = edges
      .filter((e) => findEdgeOwner(e.source, e.target) === id)
      .map((e) => ({
        id: `elk_${edgeCounter++}`,
        sources: [resolveToLevel(e.source, id)],
        targets: [resolveToLevel(e.target, id)],
      }));

    return {
      id,
      layoutOptions: {
        "elk.algorithm": "layered",
        "elk.direction": "RIGHT",
        "elk.spacing.nodeNode": String(V_GAP),
        "elk.layered.spacing.nodeNodeBetweenLayers": String(H_GAP),
        "elk.padding": `[top=${h + V_GAP},left=${COMPOUND_PAD},bottom=${COMPOUND_PAD},right=${COMPOUND_PAD}]`,
      },
      children: elkChildren,
      edges: elkEdges,
    };
  };

  // ── Build root graph ───────────────────────────────────────────────────────
  const rootChildren: ElkNode[] = [];
  for (const n of nodes) {
    if (childToLoop.has(n.id)) continue;
    rootChildren.push(buildElkNode(n.id));
  }

  const rootEdges: ElkExtendedEdge[] = [];
  for (const e of edges) {
    const owner = findEdgeOwner(e.source, e.target);
    if (owner !== undefined) continue;
    const src = resolveToLevel(e.source, undefined);
    const tgt = resolveToLevel(e.target, undefined);
    if (src === tgt) continue;
    rootEdges.push({
      id: `elk_${edgeCounter++}`,
      sources: [src],
      targets: [tgt],
    });
  }

  const graph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.spacing.nodeNode": String(V_GAP),
      "elk.layered.spacing.nodeNodeBetweenLayers": String(H_GAP),
    },
    children: rootChildren,
    edges: rootEdges,
  };

  const laid = await elk.layout(graph);

  // ── Recursively extract positions (absolute) ───────────────────────────────
  const positionMap = new Map<string, { x: number; y: number }>();

  const extractPositions = (
    elkNodes: ElkNode[],
    offsetX: number,
    offsetY: number,
  ) => {
    for (const en of elkNodes) {
      const ax = offsetX + (en.x ?? 0);
      const ay = offsetY + (en.y ?? 0);
      positionMap.set(en.id, { x: ax, y: ay });
      if (en.children) {
        extractPositions(en.children as ElkNode[], ax, ay);
      }
    }
  };

  extractPositions((laid.children ?? []) as ElkNode[], 0, 0);

  return nodes.map((n) => ({
    ...n,
    position: positionMap.get(n.id) ?? n.position,
  }));
};
