import { type ReactNode } from "react";
import { HarnessCanvasStoreContext, createHarnessCanvasStore } from "./harnessCanvasStore";
import type { PipelineNode, PipelineEdge } from "./canvasSlice";
import { useInit } from "@/hooks/useInit";

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
  const store = useInit(() =>
    createHarnessCanvasStore(
      pipeline?.nodes as PipelineNode[] | undefined,
      pipeline?.edges as PipelineEdge[] | undefined,
      pipeline?.id ?? null,
      pipeline?.name ?? ""
    )
  );

  return (
    <HarnessCanvasStoreContext.Provider value={store}>
      {children}
    </HarnessCanvasStoreContext.Provider>
  );
};
