import type { NodeRunStatus } from "@repo/schemas";
import type { CanvasStoreState } from "./canvasStore";

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
