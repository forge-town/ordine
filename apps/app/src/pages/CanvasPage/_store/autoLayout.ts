import type { PipelineNode, PipelineEdge } from "./canvasSlice";
import type { LoopNodeData } from "../nodeSchemas";

const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 120;
const H_GAP = 80;
const V_GAP = 60;
const COMPOUND_PAD = 20;

// ── Kahn's topological sort (cycle-safe: leftover nodes appended) ────────────
const topoSort = (nodeIds: string[], edgeList: PipelineEdge[]): string[] => {
  const nodeSet = new Set(nodeIds);
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();

  for (const id of nodeIds) {
    adj.set(id, []);
    inDeg.set(id, 0);
  }
  for (const e of edgeList) {
    if (!nodeSet.has(e.source) || !nodeSet.has(e.target)) continue;
    if (e.source === e.target) continue;
    adj.get(e.source)!.push(e.target);
    inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const id of nodeIds) {
    if (inDeg.get(id) === 0) queue.push(id);
  }

  const result: string[] = [];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    result.push(cur);
    for (const next of adj.get(cur) ?? []) {
      const d = (inDeg.get(next) ?? 1) - 1;
      inDeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  for (const id of nodeIds) {
    if (!result.includes(id)) result.push(id);
  }
  return result;
};

export const computeAutoLayout = (
  nodes: PipelineNode[],
  edges: PipelineEdge[],
): PipelineNode[] => {
  if (nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // ── Loop structure ──────────────────────────────────────────────────────────
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

  // ── Expanded sizes (after laying out children) ─────────────────────────────
  const expandedW = new Map<string, number>();
  const expandedH = new Map<string, number>();
  const childRelPos = new Map<string, { x: number; y: number }>();

  // Recursive: layout children bottom-up (inner loops first)
  const layoutChildren = (loopId: string) => {
    const children = loopChildren.get(loopId) ?? [];
    if (children.length === 0) return;

    for (const cid of children) {
      if (loopChildren.has(cid)) layoutChildren(cid);
    }

    const childSet = new Set(children);
    const childEdges = edges.filter(
      (e) =>
        childSet.has(e.source) &&
        childSet.has(e.target) &&
        childToLoop.get(e.source) === loopId &&
        childToLoop.get(e.target) === loopId,
    );

    const order = topoSort(children, childEdges);
    const loopCardH = getSize(loopId).h;

    let cx = COMPOUND_PAD;
    let maxChildH = 0;

    for (const cid of order) {
      const w = expandedW.get(cid) ?? getSize(cid).w;
      const h = expandedH.get(cid) ?? getSize(cid).h;
      childRelPos.set(cid, { x: cx, y: loopCardH + V_GAP });
      cx += w + H_GAP;
      maxChildH = Math.max(maxChildH, h);
    }

    const totalW = cx - H_GAP + COMPOUND_PAD;
    expandedW.set(loopId, Math.max(getSize(loopId).w, totalW));
    expandedH.set(loopId, loopCardH + V_GAP + maxChildH + COMPOUND_PAD);
  };

  // Layout all top-level loops (recursion handles nesting)
  for (const loopId of loopChildren.keys()) {
    if (!childToLoop.has(loopId)) layoutChildren(loopId);
  }

  // ── Trunk: main path + side branches ─────────────────────────────────────
  const trunkIds = nodes.filter((n) => !childToLoop.has(n.id)).map((n) => n.id);
  const trunkEdges = edges.filter(
    (e) => !childToLoop.has(e.source) && !childToLoop.has(e.target),
  );
  const trunkOrder = topoSort(trunkIds, trunkEdges);

  // Build adjacency for trunk
  const trunkSet = new Set(trunkIds);
  const fwd = new Map<string, string[]>();
  const rev = new Map<string, string[]>();
  for (const id of trunkIds) {
    fwd.set(id, []);
    rev.set(id, []);
  }
  for (const e of trunkEdges) {
    if (!trunkSet.has(e.source) || !trunkSet.has(e.target)) continue;
    if (e.source === e.target) continue;
    fwd.get(e.source)!.push(e.target);
    rev.get(e.target)!.push(e.source);
  }

  // ── Find main path (longest path DP in topo order) ─────────────────────────
  const dist = new Map<string, number>();
  const parentOf = new Map<string, string | null>();

  for (const id of trunkOrder) {
    const preds = rev.get(id) ?? [];
    if (preds.length === 0) {
      dist.set(id, 0);
      parentOf.set(id, null);
    } else {
      let maxDist = -1;
      let bestPred: string | null = null;
      for (const p of preds) {
        const d = dist.get(p) ?? 0;
        if (d > maxDist) {
          maxDist = d;
          bestPred = p;
        }
      }
      dist.set(id, maxDist + 1);
      parentOf.set(id, bestPred);
    }
  }

  let mainEnd = trunkOrder[0];
  let maxD = 0;
  for (const id of trunkOrder) {
    const d = dist.get(id) ?? 0;
    if (d > maxD) {
      maxD = d;
      mainEnd = id;
    }
  }

  const mainPath: string[] = [];
  let cur: string | null = mainEnd;
  while (cur !== null) {
    mainPath.unshift(cur);
    cur = parentOf.get(cur) ?? null;
  }
  const mainPathSet = new Set(mainPath);

  // ── Find anchors for side nodes ────────────────────────────────────────────
  const sideNodes = trunkOrder.filter((id) => !mainPathSet.has(id));
  const nodeToAnchor = new Map<string, string>();

  for (const sideId of sideNodes) {
    let anchor: string | null = null;

    // BFS forward: first main-path successor
    const queue = [...(fwd.get(sideId) ?? [])];
    const visited = new Set<string>([sideId]);
    while (queue.length > 0 && anchor === null) {
      const n = queue.shift()!;
      if (visited.has(n)) continue;
      visited.add(n);
      if (mainPathSet.has(n)) {
        anchor = n;
      } else {
        for (const next of fwd.get(n) ?? []) {
          if (!visited.has(next)) queue.push(next);
        }
      }
    }

    if (anchor === null) {
      // BFS backward: first main-path predecessor
      const bQueue = [...(rev.get(sideId) ?? [])];
      const bVisited = new Set<string>([sideId]);
      while (bQueue.length > 0 && anchor === null) {
        const n = bQueue.shift()!;
        if (bVisited.has(n)) continue;
        bVisited.add(n);
        if (mainPathSet.has(n)) {
          anchor = n;
        } else {
          for (const prev of rev.get(n) ?? []) {
            if (!bVisited.has(prev)) bQueue.push(prev);
          }
        }
      }
    }

    if (anchor === null) anchor = mainPath[0];
    nodeToAnchor.set(sideId, anchor);
  }

  // Group by anchor
  const anchorGroups = new Map<string, string[]>();
  for (const [sideId, anchor] of nodeToAnchor) {
    if (!anchorGroups.has(anchor)) anchorGroups.set(anchor, []);
    anchorGroups.get(anchor)!.push(sideId);
  }

  // ── Layout main path at Y=0 ───────────────────────────────────────────────
  const positionMap = new Map<string, { x: number; y: number }>();
  let tx = 0;
  for (const id of mainPath) {
    const w = expandedW.get(id) ?? getSize(id).w;
    positionMap.set(id, { x: tx, y: 0 });
    tx += w + H_GAP;
  }

  // ── Fishbone: alternate side groups above/below their anchors ────────────
  for (const [anchor, group] of anchorGroups) {
    const anchorPos = positionMap.get(anchor)!;
    const anchorH = expandedH.get(anchor) ?? getSize(anchor).h;
    const groupEdges = trunkEdges.filter(
      (e) => group.includes(e.source) && group.includes(e.target),
    );
    const groupOrder = topoSort(group, groupEdges);

    // Alternating: even index → above (negative Y), odd → below (positive Y)
    let aboveCy = 0;
    let belowCy = anchorH;
    for (let i = 0; i < groupOrder.length; i++) {
      const sid = groupOrder[i];
      const h = expandedH.get(sid) ?? getSize(sid).h;
      if (i % 2 === 0) {
        // above spine
        aboveCy -= V_GAP + h;
        positionMap.set(sid, { x: anchorPos.x, y: aboveCy });
      } else {
        // below spine
        belowCy += V_GAP;
        positionMap.set(sid, { x: anchorPos.x, y: belowCy });
        belowCy += h;
      }
    }
  }

  // ── Offset children to absolute positions (top-down BFS) ───────────────────
  const loopQueue = [...loopChildren.keys()].filter(
    (id) => !childToLoop.has(id),
  );
  while (loopQueue.length > 0) {
    const loopId = loopQueue.shift()!;
    const loopPos = positionMap.get(loopId);
    if (!loopPos) continue;

    for (const cid of loopChildren.get(loopId) ?? []) {
      const rel = childRelPos.get(cid);
      if (!rel) continue;
      positionMap.set(cid, {
        x: loopPos.x + rel.x,
        y: loopPos.y + rel.y,
      });
      if (loopChildren.has(cid)) loopQueue.push(cid);
    }
  }

  return nodes.map((n) => ({
    ...n,
    position: positionMap.get(n.id) ?? n.position,
  }));
};
