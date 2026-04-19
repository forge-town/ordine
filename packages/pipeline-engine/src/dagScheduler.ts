/**
 * DAG Scheduler — determines execution levels for a directed acyclic graph.
 *
 * Nodes at the same level have all their dependencies satisfied and can
 * run concurrently. Levels are processed sequentially; within each level,
 * nodes execute in parallel.
 */

import { ok, err, type Result } from "neverthrow";

export interface DagNode {
  id: string;
}

export interface DagEdge {
  source: string;
  target: string;
}

export class CycleDetectedError extends Error {
  constructor() {
    super("Cycle detected in pipeline graph");
    this.name = "CycleDetectedError";
  }
}

export class DagScheduler<N extends DagNode> {
  private readonly nodes: N[];
  private readonly edges: DagEdge[];

  constructor(nodes: N[], edges: DagEdge[]) {
    this.nodes = nodes;
    this.edges = edges;
  }

  /**
   * Partition nodes into execution levels using Kahn's algorithm.
   *
   * Level 0: nodes with no incoming edges (sources).
   * Level N: nodes whose parents are all at level < N.
   *
   * Returns an array of levels, each containing the nodes that can run concurrently.
   * Returns err if a cycle is detected.
   */
  buildExecutionLevels(): Result<N[][], CycleDetectedError> {
    const nodeMap = new Map<string, N>();
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const n of this.nodes) {
      nodeMap.set(n.id, n);
      inDegree.set(n.id, 0);
      adjacency.set(n.id, []);
    }

    for (const e of this.edges) {
      adjacency.get(e.source)?.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    }

    const levels: N[][] = [];
    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    while (queue.length > 0) {
      const currentLevelIds = queue.splice(0);
      const level: N[] = [];

      for (const id of currentLevelIds) {
        const node = nodeMap.get(id);
        if (node) level.push(node);

        for (const child of adjacency.get(id) ?? []) {
          const newDeg = (inDegree.get(child) ?? 1) - 1;
          inDegree.set(child, newDeg);
          if (newDeg === 0) queue.push(child);
        }
      }

      if (level.length > 0) levels.push(level);
    }

    const scheduledCount = levels.reduce((count, level) => count + level.length, 0);
    if (scheduledCount !== this.nodes.length) {
      return err(new CycleDetectedError());
    }

    return ok(levels);
  }

  /**
   * For a given node, returns the IDs of all direct parent nodes.
   */
  getParentIds(nodeId: string): string[] {
    return this.edges.filter((e) => e.target === nodeId).map((e) => e.source);
  }
}

// Backward-compatible free functions
export const buildExecutionLevels = <N extends DagNode>(
  nodes: N[],
  edges: DagEdge[],
): Result<N[][], CycleDetectedError> => new DagScheduler(nodes, edges).buildExecutionLevels();

export const getParentIds = (nodeId: string, edges: DagEdge[]): string[] =>
  edges.filter((e) => e.target === nodeId).map((e) => e.source);
