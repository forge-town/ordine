import { type ReactNode, useRef } from "react";
import { CanvasPageStoreContext, createCanvasPageStore } from "./canvasPageStore";
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

export const CanvasPageStoreProvider = ({ children, pipeline }: Props) => {
  const storeRef = useRef<ReturnType<typeof createCanvasPageStore> | null>(null);
  const pipelineIdRef = useRef<string | null | undefined>(undefined);

  if (!storeRef.current || pipelineIdRef.current !== pipeline?.id) {
    pipelineIdRef.current = pipeline?.id;
    storeRef.current = createCanvasPageStore(
      pipeline?.nodes as PipelineNode[] | undefined,
      pipeline?.edges as PipelineEdge[] | undefined,
      pipeline?.id ?? null,
      pipeline?.name ?? "",
    );
  }

  return (
    <CanvasPageStoreContext.Provider value={storeRef.current}>
      {children}
    </CanvasPageStoreContext.Provider>
  );
};
