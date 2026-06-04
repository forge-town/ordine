import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode } from "elkjs/lib/elk-api";
import type { PipelineNode, PipelineEdge } from "./canvasSlice";

const DEFAULT_WIDTH = 280;
const DEFAULT_HEIGHT = 120;
const NODE_GAP = 72;
const LAYER_GAP = 80;
const COMPOUND_PAD = 40;

const elk = new ELK({
  defaultLayoutOptions: {
    "elk.algorithm": "layered",
    "elk.direction": "RIGHT",
    "elk.edgeRouting": "ORTHOGONAL",
    "elk.spacing.nodeNode": String(NODE_GAP),
    "elk.layered.spacing.nodeNodeBetweenLayers": String(LAYER_GAP),
    "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    "elk.layered.crossingMinimization.strategy": "LAYER_SWEEP",
  },
});

const getNodeWidth = (node: PipelineNode): number =>
  typeof node.style?.width === "number"
    ? node.style.width
    : (node.measured?.width ?? DEFAULT_WIDTH);

const getNodeHeight = (node: PipelineNode): number =>
  typeof node.style?.height === "number"
    ? node.style.height
    : (node.measured?.height ?? DEFAULT_HEIGHT);

const makeElkNode = (node: PipelineNode): ElkNode => ({
  id: node.id,
  width: getNodeWidth(node),
  height: getNodeHeight(node),
});

const makeElkEdges = (edges: PipelineEdge[], nodeIds: Set<string>) =>
  edges
    .filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target,
    )
    .map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    }));

const normalizePositions = (children: ElkNode[]): Map<string, { x: number; y: number }> => {
  if (children.length === 0) return new Map();

  const minX = Math.min(...children.map((child) => child.x ?? 0));
  const minY = Math.min(...children.map((child) => child.y ?? 0));

  return new Map(
    children.map((child) => [
      child.id,
      {
        x: (child.x ?? 0) - minX,
        y: (child.y ?? 0) - minY,
      },
    ]),
  );
};

const getCompoundChildIds = (node: PipelineNode): string[] => {
  if (node.type !== "compound" || !node.data || !("childNodeIds" in node.data)) return [];

  const childNodeIds = (node.data as { childNodeIds?: unknown }).childNodeIds;

  return Array.isArray(childNodeIds)
    ? childNodeIds.filter((id): id is string => typeof id === "string")
    : [];
};

const layoutNodes = async (nodes: PipelineNode[], edges: PipelineEdge[]) => {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const graph: ElkNode = {
    id: "root",
    children: nodes.map(makeElkNode),
    edges: makeElkEdges(edges, nodeIds),
  };

  const layouted = await elk.layout(graph);

  return normalizePositions(layouted.children ?? []);
};

export const computeAutoLayout = async (
  nodes: PipelineNode[],
  edges: PipelineEdge[],
): Promise<PipelineNode[]> => {
  if (nodes.length === 0) return [];

  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const childToCompound = new Map<string, string>();
  const compoundChildren = new Map<string, string[]>();
  const compoundSizes = new Map<string, { width: number; height: number }>();
  const childPositions = new Map<string, { x: number; y: number }>();

  for (const node of nodes) {
    const childIds = getCompoundChildIds(node).filter((childId) => nodeMap.has(childId));
    if (childIds.length === 0) continue;

    compoundChildren.set(node.id, childIds);
    for (const childId of childIds) {
      childToCompound.set(childId, node.id);
    }
  }

  for (const [compoundId, childIds] of compoundChildren) {
    const children = childIds
      .map((childId) => nodeMap.get(childId))
      .filter((node): node is PipelineNode => !!node);
    const childPositionMap = await layoutNodes(children, edges);

    const bounds = { maxRight: 0, maxBottom: 0 };
    for (const child of children) {
      const position = childPositionMap.get(child.id) ?? { x: 0, y: 0 };
      const paddedPosition = { x: position.x + COMPOUND_PAD, y: position.y + COMPOUND_PAD };
      childPositions.set(child.id, paddedPosition);
      bounds.maxRight = Math.max(bounds.maxRight, paddedPosition.x + getNodeWidth(child));
      bounds.maxBottom = Math.max(bounds.maxBottom, paddedPosition.y + getNodeHeight(child));
    }

    compoundSizes.set(compoundId, {
      width: bounds.maxRight + COMPOUND_PAD,
      height: bounds.maxBottom + COMPOUND_PAD,
    });
  }

  const topLevelNodes = nodes
    .filter((node) => !childToCompound.has(node.id))
    .map((node) => {
      const compoundSize = compoundSizes.get(node.id);

      return compoundSize
        ? ({
            ...node,
            style: {
              ...node.style,
              width: compoundSize.width,
              height: compoundSize.height,
            },
            measured: {
              width: compoundSize.width,
              height: compoundSize.height,
            },
          } as PipelineNode)
        : node;
    });

  const topLevelPositionMap = await layoutNodes(topLevelNodes, edges);

  return nodes.map((node) => {
    const compoundId = childToCompound.get(node.id);
    if (compoundId) {
      return {
        ...node,
        parentId: compoundId,
        extent: "parent" as const,
        position: childPositions.get(node.id) ?? node.position,
      };
    }

    const compoundSize = compoundSizes.get(node.id);
    if (compoundSize) {
      return {
        ...node,
        position: topLevelPositionMap.get(node.id) ?? node.position,
        style: {
          ...node.style,
          width: compoundSize.width,
          height: compoundSize.height,
        },
      };
    }

    return {
      ...node,
      position: topLevelPositionMap.get(node.id) ?? node.position,
    };
  });
};
