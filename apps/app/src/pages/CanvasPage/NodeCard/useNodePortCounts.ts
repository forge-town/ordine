import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { useHarnessCanvasStore } from "../_store";
import { getNodePortCounts } from "./nodePorts";

export const useNodePortCounts = (nodeId: string) => {
  const store = useHarnessCanvasStore();

  return useStore(
    store,
    useShallow((state) => getNodePortCounts(state.edges, nodeId, state.connectStart))
  );
};
