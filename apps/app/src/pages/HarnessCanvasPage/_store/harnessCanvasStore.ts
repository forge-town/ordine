import { createContext, useContext } from "react";
import {
  createStore,
  type Mutate,
  type StateCreator,
  type StoreApi,
} from "zustand";
import { createCanvasSlice, type CanvasSlice } from "./canvasSlice";
import { createUISlice, type UISlice } from "./uiSlice";

export interface HarnessCanvasState extends CanvasSlice, UISlice {}

export type HarnessCanvasStoreSlice<T = HarnessCanvasState> = StateCreator<
  HarnessCanvasState,
  [],
  [],
  T
>;

export type HarnessCanvasStore = Mutate<StoreApi<HarnessCanvasState>, []>;

export const createHarnessCanvasStore = (
  initialNodes?: import("./canvasSlice").PipelineNode[],
  initialEdges?: import("./canvasSlice").PipelineEdge[],
) => {
  return createStore<HarnessCanvasState>()((set, get, api) => ({
    ...createCanvasSlice(
      set as Parameters<HarnessCanvasStoreSlice>[0],
      initialNodes,
      initialEdges,
    ),
    ...createUISlice(set as Parameters<HarnessCanvasStoreSlice>[0]),
  }));
};

export const HarnessCanvasStoreContext =
  createContext<HarnessCanvasStore | null>(null);

export const useHarnessCanvasStore = () => {
  const context = useContext(HarnessCanvasStoreContext);
  if (!context) {
    throw new Error(
      "useHarnessCanvasStore must be used within HarnessCanvasStoreProvider",
    );
  }
  return context;
};
