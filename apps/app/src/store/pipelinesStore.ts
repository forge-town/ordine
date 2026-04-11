import { createContext, useContext } from "react";
import { createStore, type StoreApi } from "zustand";
import type { PipelineNode, PipelineEdge } from "@/models/types/pipelineGraph";

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  tags: string[];
  nodeCount: number;
  createdAt: number;
  updatedAt: number;
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

// State Slice
interface PipelinesStateSlice {
  pipelines: Pipeline[];
  activePipelineId: string | null;
}

// Actions Slice
interface PipelinesActionsSlice {
  handleActivePipelineIdChange: (id: string | null) => void;
  addPipeline: (pipeline: Pipeline) => void;
  removePipeline: (id: string) => void;
  updatePipelineGraph: (id: string, nodes: PipelineNode[], edges: PipelineEdge[]) => void;
}

export type PipelinesStoreState = PipelinesStateSlice & PipelinesActionsSlice;

export type PipelinesStore = StoreApi<PipelinesStoreState>;

export const createPipelinesStore = (initialPipelines: Pipeline[] = []) =>
  createStore<PipelinesStoreState>()((set) => ({
    pipelines: initialPipelines,
    activePipelineId: null,

    handleActivePipelineIdChange: (id) => set({ activePipelineId: id }),

    addPipeline: (pipeline) => set((s) => ({ pipelines: [...s.pipelines, pipeline] })),

    removePipeline: (id) => set((s) => ({ pipelines: s.pipelines.filter((p) => p.id !== id) })),

    updatePipelineGraph: (id, nodes, edges) =>
      set((s) => ({
        pipelines: s.pipelines.map((p) =>
          p.id === id
            ? {
                ...p,
                nodes,
                edges,
                updatedAt: Date.now(),
                nodeCount: nodes.length,
              }
            : p
        ),
      })),
  }));

export const PipelinesStoreContext = createContext<PipelinesStore | null>(null);

export const usePipelinesStore = () => {
  const context = useContext(PipelinesStoreContext);
  if (!context) {
    throw new Error("usePipelinesStore must be used within PipelinesStoreProvider");
  }
  return context;
};
