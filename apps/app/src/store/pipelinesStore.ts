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

interface PipelinesState {
  pipelines: Pipeline[];
  activePipelineId: string | null;
  setActivePipelineId: (id: string | null) => void;
  addPipeline: (pipeline: Pipeline) => void;
  removePipeline: (id: string) => void;
  updatePipelineGraph: (
    id: string,
    nodes: PipelineNode[],
    edges: PipelineEdge[],
  ) => void;
}

export const usePipelinesStore = create<PipelinesState>()((set) => ({
  pipelines: [],
  activePipelineId: null,
  setActivePipelineId: (id) => set({ activePipelineId: id }),
  addPipeline: (pipeline) =>
    set((s) => ({ pipelines: [...s.pipelines, pipeline] })),
  removePipeline: (id) =>
    set((s) => ({ pipelines: s.pipelines.filter((p) => p.id !== id) })),
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
          : p,
      ),
    })),
}));
