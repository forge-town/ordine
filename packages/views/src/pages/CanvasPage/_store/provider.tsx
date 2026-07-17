import { type ReactNode, useRef } from "react";
import { useDataProvider } from "@refinedev/core";
import { setCanvasDataProvider } from "../../../lib/canvasDataProvider";
import { CanvasPageStoreContext, createCanvasPageStore } from "./canvasPageStore";
import type { PipelineNode, PipelineEdge } from "./canvasSlice";

interface LoadedPipeline {
  id: string;
  name: string;
  description?: string;
  sharedContext?: string;
  nodes: unknown[];
  edges: unknown[];
}

interface Props {
  children: ReactNode;
  pipeline?: LoadedPipeline | null;
}

export const CanvasPageStoreProvider = ({ children, pipeline }: Props) => {
  // Register the app's Refine DataProvider so non-React store actions can use it
  // (keeps @repo/views free of any client-specific data layer).
  const getDataProvider = useDataProvider();
  setCanvasDataProvider(getDataProvider());

  const storeRef = useRef<ReturnType<typeof createCanvasPageStore> | null>(null);
  const pipelineIdRef = useRef<string | null | undefined>(undefined);

  if (!storeRef.current || pipelineIdRef.current !== pipeline?.id) {
    pipelineIdRef.current = pipeline?.id;
    storeRef.current = createCanvasPageStore(
      pipeline?.nodes as PipelineNode[] | undefined,
      pipeline?.edges as PipelineEdge[] | undefined,
      pipeline?.id ?? null,
      pipeline?.name ?? "",
      pipeline?.sharedContext ?? "",
    );
  }

  return (
    <CanvasPageStoreContext.Provider value={storeRef.current}>
      {children}
    </CanvasPageStoreContext.Provider>
  );
};
