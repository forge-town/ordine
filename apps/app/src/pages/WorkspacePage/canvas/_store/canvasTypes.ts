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

const isAncestor = (
  ancestorId: string,
  node: CanvasNode,
  nodeById: ReadonlyMap<string, CanvasNode>,
): boolean => {
  const visited = new Set<string>();
  const cursor = { parentId: node.parentId };

  while (cursor.parentId) {
    if (cursor.parentId === ancestorId) {
      return true;
    }
    if (visited.has(cursor.parentId)) {
      return false;
    }

    visited.add(cursor.parentId);
    cursor.parentId = nodeById.get(cursor.parentId)?.parentId;
  }

  return false;
};

export const sortParentBeforeChildren = (nodes: readonly CanvasNode[]): CanvasNode[] => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const originalIndex = new Map(nodes.map((node, index) => [node.id, index]));

  return [...nodes].sort((a, b) => {
    if (isAncestor(a.id, b, nodeById)) {
      return -1;
    }
    if (isAncestor(b.id, a, nodeById)) {
      return 1;
    }

    return (originalIndex.get(a.id) ?? 0) - (originalIndex.get(b.id) ?? 0);
  });
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
