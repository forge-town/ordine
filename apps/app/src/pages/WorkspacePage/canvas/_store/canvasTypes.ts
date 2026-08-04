import type { Edge, Node } from "@xyflow/react";
import type {
  BuiltinNodeType,
  PipelineEdgeData,
  PipelineGraphSnapshot,
  PipelineNodeData,
} from "@repo/schemas";

export type CanvasNode = Node<PipelineNodeData, BuiltinNodeType>;
export type CanvasEdge = Edge<PipelineEdgeData>;

type CanvasSnapshot = {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
};

type SnapshotNode = PipelineGraphSnapshot["nodes"][number];
type SnapshotEdge = PipelineGraphSnapshot["edges"][number];

export const sortParentBeforeChildren = (nodes: readonly CanvasNode[]): CanvasNode[] => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const originalIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const childrenByParent = new Map<string, CanvasNode[]>();

  for (const node of nodes) {
    if (!node.parentId || !nodeById.has(node.parentId)) {
      continue;
    }
    const children = childrenByParent.get(node.parentId) ?? [];
    children.push(node);
    childrenByParent.set(node.parentId, children);
  }

  const sorted: CanvasNode[] = [];
  const visited = new Set<string>();
  const treeIndexById = new Map<string, number>();
  const getTreeIndex = (node: CanvasNode, visiting = new Set<string>()): number => {
    const cached = treeIndexById.get(node.id);
    if (cached !== undefined) {
      return cached;
    }
    if (visiting.has(node.id)) {
      return originalIndex.get(node.id) ?? 0;
    }

    visiting.add(node.id);
    const index = Math.min(
      originalIndex.get(node.id) ?? 0,
      ...(childrenByParent.get(node.id) ?? []).map((child) => getTreeIndex(child, visiting)),
    );
    visiting.delete(node.id);
    treeIndexById.set(node.id, index);

    return index;
  };
  const visit = (node: CanvasNode) => {
    if (visited.has(node.id)) {
      return;
    }
    visited.add(node.id);
    sorted.push(node);
    for (const child of childrenByParent.get(node.id) ?? []) {
      visit(child);
    }
  };

  const roots = nodes
    .filter((node) => !node.parentId || !nodeById.has(node.parentId))
    .sort((a, b) => getTreeIndex(a) - getTreeIndex(b));
  for (const node of roots) {
    visit(node);
  }
  for (const node of nodes) {
    visit(node);
  }

  return sorted;
};

export const fromPipelineSnapshot = (snapshot: PipelineGraphSnapshot): CanvasSnapshot => ({
  nodes: sortParentBeforeChildren(
    snapshot.nodes.map(
      (node): CanvasNode => ({
        ...node,
      }),
    ),
  ),
  edges: snapshot.edges.map(
    (edge): CanvasEdge => ({
      ...edge,
    }),
  ),
});

export const toPipelineSnapshot = (snapshot: CanvasSnapshot): PipelineGraphSnapshot => ({
  nodes: sortParentBeforeChildren(snapshot.nodes).map((node) => {
    return { ...node } as SnapshotNode;
  }),
  edges: snapshot.edges.map((edge) => {
    return { ...edge } as SnapshotEdge;
  }),
});
