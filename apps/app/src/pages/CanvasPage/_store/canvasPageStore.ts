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

export interface CanvasPageState extends CanvasSlice, UISlice, HistorySlice, ActionsSlice {}

export type CanvasPageStoreSlice<T = CanvasPageState> = StateCreator<CanvasPageState, [], [], T>;

export type CanvasPageStore = Mutate<StoreApi<CanvasPageState>, []>;

export const createCanvasPageStore = (
  initialNodes?: PipelineNode[],
  initialEdges?: PipelineEdge[],
  pipelineId?: string | null,
  pipelineName?: string,
) => {
  return createStore<CanvasPageState>()((set, get) => ({
    ...createCanvasSlice(
      set as Parameters<CanvasPageStoreSlice>[0],
      get as Parameters<CanvasPageStoreSlice>[1],
      initialNodes,
      initialEdges,
    ),
    ...createUISlice(
      set as Parameters<CanvasPageStoreSlice>[0],
      get as Parameters<CanvasPageStoreSlice>[1],

      pipelineId ?? null,
      pipelineName ?? "",
    ),
    ...createHistorySlice(
      set as Parameters<CanvasPageStoreSlice>[0],
      get as Parameters<CanvasPageStoreSlice>[1],
    ),
    ...createActionsSlice(
      set as Parameters<CanvasPageStoreSlice>[0],
      get as Parameters<CanvasPageStoreSlice>[1],
    ),
  }));
};

export const CanvasPageStoreContext = createContext<CanvasPageStore | null>(null);

export const selectSelectedNode = (state: CanvasPageState) =>
  state.nodes.find((node) => node.id === state.selectedNodeId);

export const useCanvasPageStore = () => {
  const context = useContext(CanvasPageStoreContext);
  if (!context) {
    throw new Error("useCanvasPageStore must be used within CanvasPageStoreProvider");
  }

  return context;
};
