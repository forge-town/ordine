import { type ReactNode, useRef } from "react";
import {
  HarnessCanvasStoreContext,
  createHarnessCanvasStore,
  type HarnessCanvasStore,
} from "./harnessCanvasStore";
import type { PipelineNode, PipelineEdge } from "./canvasSlice";

interface LoadedPipeline {
  id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
}

interface Props {
  children: ReactNode;
  pipeline?: LoadedPipeline | null;
}

export const HarnessCanvasStoreProvider = ({ children, pipeline }: Props) => {
  const storeRef = useRef<HarnessCanvasStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createHarnessCanvasStore(
      pipeline?.nodes as PipelineNode[] | undefined,
      pipeline?.edges as PipelineEdge[] | undefined,
      pipeline?.id ?? null,
      pipeline?.name ?? "",
    );
  }

  return (
    <HarnessCanvasStoreContext.Provider value={storeRef.current}>
      {children}
    </HarnessCanvasStoreContext.Provider>
  );
};
