import type { NodeRunStatus } from "@repo/schemas";
import type { HarnessCanvasState } from "./harnessCanvasStore";
import {
  decorateEdgesWithPortHandles,
  getNodePortVisualCounts,
  type PendingNodePortConnection,
} from "../NodeCard/nodePorts";
import type { PipelineEdge, PipelineNode } from "./canvasSlice";

export interface NodeRunState {
  runStatus: NodeRunStatus | undefined;
  dimmed: boolean;
}

export const selectNodeRunState =
  (nodeId: string) =>
  (state: HarnessCanvasState): NodeRunState => {
    const runStatus = state.nodeRunStatuses[nodeId];
    const dimmed =
      state.isTestRunning &&
      state.runningNodeId !== null &&
      state.runningNodeId !== nodeId &&
      runStatus !== "running";

    return { runStatus, dimmed };
  };

const portRoutingCache: {
  connectStartRef: PendingNodePortConnection | null;
  decoratedEdges: PipelineEdge[];
  edgesRef: PipelineEdge[] | null;
  nodesRef: PipelineNode[] | null;
} = {
  connectStartRef: null,
  decoratedEdges: [],
  edgesRef: null,
  nodesRef: null,
};

const getCachedDecoratedEdges = (
  nodes: PipelineNode[],
  edges: PipelineEdge[],
  connectStart: PendingNodePortConnection | null,
) => {
  if (
    portRoutingCache.nodesRef === nodes &&
    portRoutingCache.edgesRef === edges &&
    portRoutingCache.connectStartRef === connectStart
  ) {
    return portRoutingCache.decoratedEdges;
  }

  portRoutingCache.nodesRef = nodes;
  portRoutingCache.edgesRef = edges;
  portRoutingCache.connectStartRef = connectStart;
  portRoutingCache.decoratedEdges = decorateEdgesWithPortHandles(nodes, edges, connectStart);

  return portRoutingCache.decoratedEdges;
};

export const selectNodePortCounts = (nodeId: string) => (state: HarnessCanvasState) =>
  getNodePortVisualCounts(
    state.nodes,
    state.edges,
    nodeId,
    state.connectStart,
    getCachedDecoratedEdges(state.nodes, state.edges, state.connectStart),
  );
