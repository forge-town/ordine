import type { PipelineNode, PipelineEdge } from "./canvasSlice";

const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 120;
const H_GAP = 80;
const V_GAP = 60;
const COMPOUND_PAD = 40;

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

  // ── Identify compound nodes and their children ────────────────────────────
  const childToCompound = new Map<string, string>();
  const compoundChildren = new Map<string, string[]>();

  for (const n of nodes) {
    if (n.type === "compound" && n.data && "childNodeIds" in n.data) {
      const childIds = (n.data as { childNodeIds: string[] }).childNodeIds;
      compoundChildren.set(n.id, childIds);
      for (const cid of childIds) {
        childToCompound.set(cid, n.id);
      }
    }
  }

  const childSet = new Set(childToCompound.keys());

  // ── Layout children inside compounds & compute expanded sizes ─────────────
  const compoundSizes = new Map<string, { w: number; h: number }>();
  const childRelPos = new Map<string, { x: number; y: number }>();

  for (const [compoundId, children] of compoundChildren) {
    const validChildren = children.filter((cid) => nodeMap.has(cid));
    if (validChildren.length === 0) continue;

    const cSet = new Set(validChildren);
    const internalEdges = edges.filter(
      (e) => cSet.has(e.source) && cSet.has(e.target),
    );

    const childOrder = topoSort(validChildren, internalEdges);
    let cx = COMPOUND_PAD;
    let maxH = 0;

    for (const cid of childOrder) {
      const cn = nodeMap.get(cid);
      const w = cn?.measured?.width ?? DEFAULT_WIDTH;
      const h = cn?.measured?.height ?? DEFAULT_HEIGHT;
      childRelPos.set(cid, { x: cx, y: COMPOUND_PAD });
      cx += w + H_GAP;
      maxH = Math.max(maxH, h);
    }

    const expandedW = cx - H_GAP + COMPOUND_PAD;
    const expandedH = maxH + 2 * COMPOUND_PAD;
    compoundSizes.set(compoundId, { w: expandedW, h: expandedH });
  }

  // ── Size helper (uses expanded size for compounds) ────────────────────────
  const getSize = (id: string) => {
    const expanded = compoundSizes.get(id);
    if (expanded) return expanded;
    const n = nodeMap.get(id);
    return {
      w: n?.measured?.width ?? DEFAULT_WIDTH,
      h: n?.measured?.height ?? DEFAULT_HEIGHT,
    };
  };

  // ── Trunk: top-level nodes only (exclude compound children) ───────────────
  const topLevelIds = nodes.filter((n) => !childSet.has(n.id)).map((n) => n.id);
  const trunkOrder = topoSort(topLevelIds, edges);

  // Build adjacency (top-level only)
  const nodeSet = new Set(topLevelIds);
  const fwd = new Map<string, string[]>();
  const rev = new Map<string, string[]>();
  for (const id of topLevelIds) {
    fwd.set(id, []);
    rev.set(id, []);
  }
  for (const e of edges) {
    if (!nodeSet.has(e.source) || !nodeSet.has(e.target)) continue;
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
    const w = getSize(id).w;
    positionMap.set(id, { x: tx, y: 0 });
    tx += w + H_GAP;
  }

  // ── Fishbone: alternate side groups above/below their anchors ────────────
  for (const [anchor, group] of anchorGroups) {
    const anchorPos = positionMap.get(anchor)!;
    const anchorH = getSize(anchor).h;
    const groupEdges = edges.filter(
      (e) => group.includes(e.source) && group.includes(e.target),
    );
    const groupOrder = topoSort(group, groupEdges);

    // Alternating: even index → above (negative Y), odd → below (positive Y)
    let aboveCy = 0;
    let belowCy = anchorH;
    for (let i = 0; i < groupOrder.length; i++) {
      const sid = groupOrder[i];
      const h = getSize(sid).h;
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

  return nodes.map((n) => {
    // Child of a compound: set parentId and relative position
    const compoundId = childToCompound.get(n.id);
    if (compoundId) {
      return {
        ...n,
        parentId: compoundId,
        extent: "parent" as const,
        position: childRelPos.get(n.id) ?? n.position,
      };
    }

    // Compound node: set expanded style
    const expanded = compoundSizes.get(n.id);
    if (expanded) {
      return {
        ...n,
        position: positionMap.get(n.id) ?? n.position,
        style: { ...n.style, width: expanded.w, height: expanded.h },
      };
    }

    return {
      ...n,
      position: positionMap.get(n.id) ?? n.position,
    };
  });
};
