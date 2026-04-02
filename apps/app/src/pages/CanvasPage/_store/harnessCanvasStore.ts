import { createContext, useContext } from "react";
import {
  createStore,
  type Mutate,
  type StateCreator,
  type StoreApi,
} from "zustand";
import {
  createCanvasSlice,
  type CanvasSlice,
  type PipelineNode,
  type PipelineEdge,
} from "./canvasSlice";
import { createUISlice, type UISlice } from "./uiSlice";
import type { OperationEntity } from "@/models/daos/operationsDao";

export interface HarnessCanvasState extends CanvasSlice, UISlice {
  operations: OperationEntity[];
  getOperationById: (id: string) => OperationEntity | undefined;
  getAcceptedOperationsForObject: (objectType: string) => OperationEntity[];
}

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
  pipelineName?: string,
  operations?: OperationEntity[],
) => {
  const ops = operations ?? [];

  return createStore<HarnessCanvasState>()((set, get) => ({
    ...createCanvasSlice(
      set as Parameters<HarnessCanvasStoreSlice>[0],
      initialNodes,
      initialEdges,
    ),
    ...createUISlice(
      set as Parameters<HarnessCanvasStoreSlice>[0],
      pipelineId ?? null,
      pipelineName ?? "",
    ),
    operations: ops,
    getOperationById: (id: string) => {
      return get().operations.find((op) => op.id === id);
    },
    getAcceptedOperationsForObject: (objectType: string) => {
      return get().operations.filter((op) =>
        Array.isArray(op.acceptedObjectTypes) && op.acceptedObjectTypes.includes(objectType as "file" | "folder" | "project"),
      );
    },
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
