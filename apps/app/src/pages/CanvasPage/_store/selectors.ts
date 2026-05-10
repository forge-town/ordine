import type { NodeRunStatus } from "@repo/pipeline-engine/schemas";
import type { HarnessCanvasState } from "./harnessCanvasStore";
import { getNodePortCounts } from "../NodeCard/nodePorts";

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

export const selectNodePortCounts = (nodeId: string) => (state: HarnessCanvasState) =>
  getNodePortCounts(state.edges, nodeId, state.connectStart);
