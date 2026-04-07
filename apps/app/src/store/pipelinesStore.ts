import { create } from "zustand";
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
  setActivePipelineId: (id: string | null) => void;
  addPipeline: (pipeline: Pipeline) => void;
  removePipeline: (id: string) => void;
  updatePipelineGraph: (id: string, nodes: PipelineNode[], edges: PipelineEdge[]) => void;
}

export type PipelinesStoreState = PipelinesStateSlice & PipelinesActionsSlice;

// Initial State
const initialState: PipelinesStateSlice = {
  pipelines: [],
  activePipelineId: null,
};

// Store Hook
export const usePipelinesStore = create<PipelinesStoreState>()((set) => ({
  ...initialState,

  setActivePipelineId: (id) => set({ activePipelineId: id }),

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
