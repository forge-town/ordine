import type { PipelineEdge, PipelineNode } from "../_store/canvasSlice";

export type NodePortSide = "left" | "right";

export interface PendingNodePortConnection {
  nodeId: string;
  handleId?: string | null;
  handleType?: "source" | "target" | null;
}

export interface NodePortVisualCounts {
  leftPortCount: number;
  rightPortCount: number;
  leftConnectedPortCount: number;
  rightConnectedPortCount: number;
  leftActivePortCount: number;
  rightActivePortCount: number;
  leftConnectedPortMask: number;
  rightConnectedPortMask: number;
  leftActivePortMask: number;
  rightActivePortMask: number;
}

const DEFAULT_NODE_HEIGHT = 120;
const MAX_PORT_SPREAD = 42;
const MIN_PORT_SPREAD = 28;
const PORT_SPREAD_STEP = 8;
const EXTENDED_PORT_GAP = 28;
const EXTENDED_PORT_THRESHOLD = 4;

export const makeNodePortId = (side: NodePortSide, index: number) => `${side}-port-${index}`;

const getNodePortIndex = (side: NodePortSide, handleId?: string | null): number | null => {
  const prefix = `${side}-port-`;
  if (!handleId?.startsWith(prefix)) {
    return null;
  }

  const index = Number.parseInt(handleId.slice(prefix.length), 10);

  return Number.isInteger(index) && index >= 0 ? index : null;
};

const getPendingPortSide = (
  pendingConnection: PendingNodePortConnection | null | undefined,
  nodeId: string,
): NodePortSide | null => {
  if (!pendingConnection || pendingConnection.nodeId !== nodeId) {
    return null;
  }

  if (pendingConnection.handleType === "source") {
    return "right";
  }

  return pendingConnection.handleType === "target" ? "left" : null;
};

const clampPortSpread = (spread: number, maxSpread?: number): number => {
  if (!Number.isFinite(maxSpread) || maxSpread === undefined || maxSpread < 0) {
    return spread;
  }

  return Math.min(spread, maxSpread);
};

export const getNodePortOffsets = (count: number, maxSpread?: number): number[] => {
  const safeCount = Math.max(1, count);

  if (safeCount === 1) {
    return [0];
  }

  const spread =
    safeCount > EXTENDED_PORT_THRESHOLD
      ? ((safeCount - 1) * EXTENDED_PORT_GAP) / 2
      : Math.min(MAX_PORT_SPREAD, MIN_PORT_SPREAD + (safeCount - 2) * PORT_SPREAD_STEP);
  const clampedSpread = clampPortSpread(spread, maxSpread);

  return Array.from({ length: safeCount }, (_item, index) =>
    Math.round(-clampedSpread + (clampedSpread * 2 * index) / (safeCount - 1)),
  );
};

export const getNodePortCount = (
  edges: PipelineEdge[],
  nodeId: string,
  side: NodePortSide,
  pendingConnection?: PendingNodePortConnection | null,
): number => {
  const connectionCount = edges.filter((edge) =>
    side === "left" ? edge.target === nodeId : edge.source === nodeId,
  ).length;
  const pendingConnectionCount = getPendingPortSide(pendingConnection, nodeId) === side ? 1 : 0;

  return Math.max(1, connectionCount + pendingConnectionCount);
};

export const getNodePortCounts = (
  edges: PipelineEdge[],
  nodeId: string,
  pendingConnection?: PendingNodePortConnection | null,
) => {
  const { leftConnectionCount, rightConnectionCount } = edges.reduce(
    (counts, edge) => ({
      leftConnectionCount: counts.leftConnectionCount + (edge.target === nodeId ? 1 : 0),
      rightConnectionCount: counts.rightConnectionCount + (edge.source === nodeId ? 1 : 0),
    }),
    { leftConnectionCount: 0, rightConnectionCount: 0 },
  );
  const pendingSide = getPendingPortSide(pendingConnection, nodeId);

  return {
    leftPortCount: Math.max(1, leftConnectionCount + (pendingSide === "left" ? 1 : 0)),
    rightPortCount: Math.max(1, rightConnectionCount + (pendingSide === "right" ? 1 : 0)),
  };
};

const getNodeHeight = (node: PipelineNode): number => {
  const styleHeight =
    typeof node.style?.height === "number"
      ? node.style.height
      : Number.parseFloat(String(node.style?.height ?? ""));
  const measuredHeight = node.measured?.height;

  return Number.isFinite(styleHeight) && styleHeight > 0
    ? styleHeight
    : (measuredHeight ?? DEFAULT_NODE_HEIGHT);
};

const getNodeCenterY = (node: PipelineNode): number => node.position.y + getNodeHeight(node) / 2;

const getOtherNodeId = (edge: PipelineEdge, side: NodePortSide): string =>
  side === "left" ? edge.source : edge.target;

const getSideEdges = (edges: PipelineEdge[], nodeId: string, side: NodePortSide): PipelineEdge[] =>
  edges.filter((edge) => (side === "left" ? edge.target === nodeId : edge.source === nodeId));

const getEdgePortHandleId = (edge: PipelineEdge, side: NodePortSide): string | null | undefined =>
  side === "left" ? edge.targetHandle : edge.sourceHandle;

const compareByOtherNodeY =
  (nodeById: Map<string, PipelineNode>, side: NodePortSide) =>
  (a: PipelineEdge, b: PipelineEdge): number => {
    const aNode = nodeById.get(getOtherNodeId(a, side));
    const bNode = nodeById.get(getOtherNodeId(b, side));
    const aY = aNode ? getNodeCenterY(aNode) : 0;
    const bY = bNode ? getNodeCenterY(bNode) : 0;
    const yDelta = aY - bY;

    return yDelta === 0 ? a.id.localeCompare(b.id) : yDelta;
  };

const makePortAssignments = (
  nodes: PipelineNode[],
  edges: PipelineEdge[],
  side: NodePortSide,
  pendingConnection?: PendingNodePortConnection | null,
): Map<string, string> => {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const assignments = new Map<string, string>();

  for (const node of nodes) {
    const sideEdges = [...getSideEdges(edges, node.id, side)].sort(
      compareByOtherNodeY(nodeById, side),
    );
    const hasPendingConnection = getPendingPortSide(pendingConnection, node.id) === side;
    const slotCount = Math.max(1, sideEdges.length + (hasPendingConnection ? 1 : 0));
    const pendingIndex = hasPendingConnection
      ? getNodePortIndex(side, pendingConnection?.handleId)
      : null;
    const usedIndexes = new Set<number>();
    const autoAssignedEdges: PipelineEdge[] = [];

    if (pendingIndex !== null && pendingIndex < slotCount) {
      usedIndexes.add(pendingIndex);
    }

    for (const edge of sideEdges) {
      const explicitIndex = getNodePortIndex(side, getEdgePortHandleId(edge, side));
      if (explicitIndex !== null && explicitIndex < slotCount && !usedIndexes.has(explicitIndex)) {
        assignments.set(edge.id, makeNodePortId(side, explicitIndex));
        usedIndexes.add(explicitIndex);
      } else {
        autoAssignedEdges.push(edge);
      }
    }

    const availableIndexes = Array.from({ length: slotCount }, (_item, index) => index)
      .filter((index) => !usedIndexes.has(index))
      .slice(0, autoAssignedEdges.length);

    for (const [edge, index] of autoAssignedEdges.flatMap((edge, edgeIndex) => {
      const index = availableIndexes[edgeIndex];

      return index === undefined ? [] : ([[edge, index]] as const);
    })) {
      assignments.set(edge.id, makeNodePortId(side, index));
    }
  }

  return assignments;
};

export const decorateEdgesWithPortHandles = (
  nodes: PipelineNode[],
  edges: PipelineEdge[],
  pendingConnection?: PendingNodePortConnection | null,
): PipelineEdge[] => {
  const sourceHandleByEdgeId = makePortAssignments(nodes, edges, "right", pendingConnection);
  const targetHandleByEdgeId = makePortAssignments(nodes, edges, "left", pendingConnection);

  return edges.map((edge) => {
    const sourceHandle =
      sourceHandleByEdgeId.get(edge.id) ?? edge.sourceHandle ?? makeNodePortId("right", 0);
    const targetHandle =
      targetHandleByEdgeId.get(edge.id) ?? edge.targetHandle ?? makeNodePortId("left", 0);

    if (edge.sourceHandle === sourceHandle && edge.targetHandle === targetHandle) {
      return edge;
    }

    return {
      ...edge,
      sourceHandle,
      targetHandle,
    };
  });
};

const MAX_SAFE_PORT_INDEX = 52;

const isSafePortIndex = (index: number): boolean =>
  Number.isInteger(index) && index >= 0 && index <= MAX_SAFE_PORT_INDEX;

const getPortIndexMask = (index: number): number => (isSafePortIndex(index) ? 2 ** index : 0);

const hasPortIndex = (mask: number, index: number): boolean => {
  const indexMask = getPortIndexMask(index);

  return indexMask > 0 && Math.floor(mask / indexMask) % 2 === 1;
};

const addPortIndexToMask = (mask: number, index: number): number => {
  const indexMask = getPortIndexMask(index);

  return indexMask === 0 || hasPortIndex(mask, index) ? mask : mask + indexMask;
};

const getConnectedPortMasks = (
  edges: PipelineEdge[],
  nodeId: string,
): { left: number; right: number; leftCount: number; rightCount: number } =>
  edges.reduce(
    (acc, edge) => {
      if (edge.target === nodeId) {
        const index = getNodePortIndex("left", getEdgePortHandleId(edge, "left")) ?? 0;
        acc.left = addPortIndexToMask(acc.left, index);
        acc.leftCount += 1;
      }
      if (edge.source === nodeId) {
        const index = getNodePortIndex("right", getEdgePortHandleId(edge, "right")) ?? 0;
        acc.right = addPortIndexToMask(acc.right, index);
        acc.rightCount += 1;
      }

      return acc;
    },
    { left: 0, right: 0, leftCount: 0, rightCount: 0 },
  );

const getActivePortMask = (
  pendingConnection: PendingNodePortConnection | null | undefined,
  nodeId: string,
  side: NodePortSide,
  portCount: number,
  connectedPortMask: number,
): number => {
  if (getPendingPortSide(pendingConnection, nodeId) !== side) {
    return 0;
  }

  const explicitIndex = getNodePortIndex(side, pendingConnection?.handleId);
  if (explicitIndex !== null && explicitIndex < portCount) {
    return getPortIndexMask(explicitIndex);
  }

  const safePortCount = Math.min(portCount, MAX_SAFE_PORT_INDEX + 1);
  const availableIndex = Array.from({ length: safePortCount }, (_item, index) => index).find(
    (index) => !hasPortIndex(connectedPortMask, index),
  );

  return availableIndex === undefined ? 0 : getPortIndexMask(availableIndex);
};

export const getNodePortVisualCounts = (
  nodes: PipelineNode[],
  edges: PipelineEdge[],
  nodeId: string,
  pendingConnection?: PendingNodePortConnection | null,
  decoratedEdgesOverride?: PipelineEdge[],
): NodePortVisualCounts => {
  const decoratedEdges =
    decoratedEdgesOverride ?? decorateEdgesWithPortHandles(nodes, edges, pendingConnection);
  const counts = getNodePortCounts(decoratedEdges, nodeId, pendingConnection);
  const pendingSide = getPendingPortSide(pendingConnection, nodeId);
  const {
    left: leftConnectedPortMask,
    right: rightConnectedPortMask,
    leftCount: leftConnectedPortCount,
    rightCount: rightConnectedPortCount,
  } = getConnectedPortMasks(decoratedEdges, nodeId);

  return {
    ...counts,
    leftConnectedPortCount,
    rightConnectedPortCount,
    leftActivePortCount: pendingSide === "left" ? 1 : 0,
    rightActivePortCount: pendingSide === "right" ? 1 : 0,
    leftConnectedPortMask,
    rightConnectedPortMask,
    leftActivePortMask: getActivePortMask(
      pendingConnection,
      nodeId,
      "left",
      counts.leftPortCount,
      leftConnectedPortMask,
    ),
    rightActivePortMask: getActivePortMask(
      pendingConnection,
      nodeId,
      "right",
      counts.rightPortCount,
      rightConnectedPortMask,
    ),
  };
};
