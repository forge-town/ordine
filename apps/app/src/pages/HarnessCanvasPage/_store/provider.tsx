import { type ReactNode, useRef } from "react";
import {
  HarnessCanvasStoreContext,
  createHarnessCanvasStore,
  type HarnessCanvasStore,
} from "./harnessCanvasStore";
import { usePipelinesStore } from "@/store/pipelinesStore";

interface Props {
  children: ReactNode;
}

export const HarnessCanvasStoreProvider = ({ children }: Props) => {
  const storeRef = useRef<HarnessCanvasStore | null>(null);
  const activePipelineId = usePipelinesStore((s) => s.activePipelineId);
  const pipelines = usePipelinesStore((s) => s.pipelines);

  if (!storeRef.current) {
    const active = activePipelineId
      ? (pipelines.find((p) => p.id === activePipelineId) ?? null)
      : null;
    storeRef.current = createHarnessCanvasStore(active?.nodes, active?.edges);
  }

  return (
    <HarnessCanvasStoreContext.Provider value={storeRef.current}>
      {children}
    </HarnessCanvasStoreContext.Provider>
  );
};
