import type { HarnessCanvasState } from "../_store/harnessCanvasStore";
import { getNodePortCounts } from "./nodePorts";

export const selectNodePortCounts = (nodeId: string) => (state: HarnessCanvasState) =>
  getNodePortCounts(state.edges, nodeId, state.connectStart);
