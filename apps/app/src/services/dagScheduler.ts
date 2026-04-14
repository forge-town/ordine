/**
 * DAG Scheduler — determines execution levels for a directed acyclic graph.
 *
 * Nodes at the same level have all their dependencies satisfied and can
 * run concurrently. Levels are processed sequentially; within each level,
 * nodes execute in parallel.
 */

export interface DagNode {
  id: string;
}

export interface DagEdge {
  source: string;
  target: string;
}

/**
 * Partition nodes into execution levels using Kahn's algorithm.
 *
 * Level 0: nodes with no incoming edges (sources).
 * Level N: nodes whose parents are all at level < N.
 *
 * Returns an array of levels, each containing the node IDs that can run concurrently.
 * Throws if a cycle is detected.
 */
export const buildExecutionLevels = <N extends DagNode>(nodes: N[], edges: DagEdge[]): N[][] => {
  const nodeMap = new Map<string, N>();
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const n of nodes) {
    nodeMap.set(n.id, n);
    inDegree.set(n.id, 0);
    adjacency.set(n.id, []);
  }

  for (const e of edges) {
    adjacency.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const levels: N[][] = [];
  const counter = { remaining: nodes.length };

  // Seed level 0 with all zero-indegree nodes
  const queue = { current: [] as string[] };
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.current.push(id);
  }

  while (queue.current.length > 0) {
    const level: N[] = [];
    const nextQueue: string[] = [];

    for (const id of queue.current) {
      const node = nodeMap.get(id);
      if (node) level.push(node);
      counter.remaining--;

      for (const child of adjacency.get(id) ?? []) {
        const newDeg = (inDegree.get(child) ?? 1) - 1;
        inDegree.set(child, newDeg);
        if (newDeg === 0) nextQueue.push(child);
      }
    }

    if (level.length > 0) levels.push(level);
    queue.current = nextQueue;
  }

  if (counter.remaining > 0) {
    throw new Error("Cycle detected in pipeline graph");
  }

  return levels;
};

/**
 * For a given node, returns the IDs of all direct parent nodes.
 */
export const getParentIds = (nodeId: string, edges: DagEdge[]): string[] =>
  edges.filter((e) => e.target === nodeId).map((e) => e.source);
