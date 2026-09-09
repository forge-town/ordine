import { type ReactNode, useRef } from "react";
import { useDataProvider } from "@refinedev/core";
import {
  setCanvasDataProvider,
  setCanvasExecutionDataProvider,
} from "../../../lib/canvasDataProvider";
import { CanvasPageStoreContext, createCanvasPageStore } from "./canvasPageStore";
import type { PipelineNode, PipelineEdge } from "./canvasSlice";
import { AgentBarStoreProvider } from "../AgentPanel/_store";

interface LoadedPipeline {
  id: string;
  name: string;
  description?: string;
  sharedContext?: string;
  nodes: unknown[];
  edges: unknown[];
  version?: number;
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
  setCanvasExecutionDataProvider(() => getDataProvider("execution"));

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
      pipeline?.version ?? 1,
    );
    if (storeRef.current.getState().executionSubmission.request)
      storeRef.current.setState({ isConsoleOpen: true });
  }

  return (
    <CanvasPageStoreContext.Provider value={storeRef.current}>
      {/* Keep the legacy store as a compatibility boundary for existing
          conversation history readers. New UI and runs use AgentThread only. */}
      <AgentBarStoreProvider pipelineId={pipeline?.id ?? null}>{children}</AgentBarStoreProvider>
    </CanvasPageStoreContext.Provider>
  );
};
