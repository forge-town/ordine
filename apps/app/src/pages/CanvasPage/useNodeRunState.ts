import { useStore } from "zustand";
import { useHarnessCanvasStore } from "./_store";
import type { NodeRunStatus } from "./nodeSchemas";

interface NodeRunState {
  runStatus: NodeRunStatus | undefined;
  dimmed: boolean;
}

export const useNodeRunState = (nodeId: string): NodeRunState => {
  const store = useHarnessCanvasStore();
  const isTestRunning = useStore(store, (s) => s.isTestRunning);
  const runningNodeId = useStore(store, (s) => s.runningNodeId);
  const nodeRunStatuses = useStore(store, (s) => s.nodeRunStatuses);

  const runStatus = nodeRunStatuses[nodeId];
  const dimmed =
    isTestRunning && runningNodeId !== null && runningNodeId !== nodeId && runStatus !== "running";

  return { runStatus, dimmed };
};
