import { createContext, useContext } from "react";
import { createStore, type Mutate, type StateCreator, type StoreApi } from "zustand";
import {
  createCanvasSlice,
  type CanvasSlice,
  type PipelineNode,
  type PipelineEdge,
} from "./canvasSlice";
import { createUISlice, type UISlice } from "./uiSlice";
import { createHistorySlice, type HistorySlice } from "./historySlice";
import { createActionsSlice, type ActionsSlice } from "./actionsSlice";

export interface HarnessCanvasState extends CanvasSlice, UISlice, HistorySlice, ActionsSlice {}

export type HarnessCanvasStoreSlice<T = HarnessCanvasState> = StateCreator<
  HarnessCanvasState,
  [],
  [],
  T
>;

export type HarnessCanvasStore = Mutate<StoreApi<HarnessCanvasState>, []>;

export const createHarnessCanvasStore = (
  initialNodes?: PipelineNode[],
  initialEdges?: PipelineEdge[],
  pipelineId?: string | null,
  pipelineName?: string
) => {
  return createStore<HarnessCanvasState>()((set, get) => ({
    ...createCanvasSlice(
      set as Parameters<HarnessCanvasStoreSlice>[0],
      get as Parameters<HarnessCanvasStoreSlice>[1],
      initialNodes,
      initialEdges
    ),
    ...createUISlice(
      set as Parameters<HarnessCanvasStoreSlice>[0],
      get as Parameters<HarnessCanvasStoreSlice>[1],

      pipelineId ?? null,
      pipelineName ?? ""
    ),
    ...createHistorySlice(
      set as Parameters<HarnessCanvasStoreSlice>[0],
      get as Parameters<HarnessCanvasStoreSlice>[1]
    ),
    ...createActionsSlice(
      set as Parameters<HarnessCanvasStoreSlice>[0],
      get as Parameters<HarnessCanvasStoreSlice>[1]
    ),
  }));
};

export const HarnessCanvasStoreContext = createContext<HarnessCanvasStore | null>(null);

export const selectSelectedNode = (state: HarnessCanvasState) =>
  state.nodes.find((node) => node.id === state.selectedNodeId);

export const useHarnessCanvasStore = () => {
  const context = useContext(HarnessCanvasStoreContext);
  if (!context) {
    throw new Error("useHarnessCanvasStore must be used within HarnessCanvasStoreProvider");
  }

  return context;
};
