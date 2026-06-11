import type { NodeRunStatus } from "@repo/schemas";
import { decorateEdgesWithPortHandles, getNodePortVisualCounts } from "../nodes/support/nodePorts";
import type { CanvasStoreState } from "./canvasStore";
import type { CanvasEdge, CanvasNode } from "./canvasTypes";

export type NodeRunState = {
  dimmed: boolean;
  runStatus: NodeRunStatus | undefined;
};

export const selectNodeRunState =
  (nodeId: string) =>
  (state: CanvasStoreState): NodeRunState => {
    const runStatus = state.nodeRunStatuses[nodeId];
    const dimmed =
      state.runningNodeId !== null && state.runningNodeId !== nodeId && runStatus !== "running";

    return { dimmed, runStatus };
  };

const portRoutingCache: {
  decoratedEdges: CanvasEdge[];
  edgesRef: CanvasEdge[] | null;
  nodesRef: CanvasNode[] | null;
} = {
  decoratedEdges: [],
  edgesRef: null,
  nodesRef: null,
};

const getCachedDecoratedEdges = (nodes: CanvasNode[], edges: CanvasEdge[]) => {
  if (portRoutingCache.nodesRef === nodes && portRoutingCache.edgesRef === edges) {
    return portRoutingCache.decoratedEdges;
  }

  portRoutingCache.nodesRef = nodes;
  portRoutingCache.edgesRef = edges;
  portRoutingCache.decoratedEdges = decorateEdgesWithPortHandles(nodes, edges);

  return portRoutingCache.decoratedEdges;
};

export const selectNodePortCounts = (nodeId: string) => (state: CanvasStoreState) =>
  getNodePortVisualCounts(
    state.nodes,
    state.edges,
    nodeId,
    null,
    getCachedDecoratedEdges(state.nodes, state.edges),
  );
