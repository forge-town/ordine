import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import { createPipelinesPageSlice, type PipelinesPageSlice } from "./pipelinesPageSlice";

export interface PipelinesPageState extends PipelinesPageSlice {}

export type PipelinesPageStoreSlice<T = PipelinesPageState> = StateCreator<
  PipelinesPageState,
  [],
  [],
  T
>;

export type PipelinesPageStore = StoreApi<PipelinesPageState>;

export const createPipelinesPageStore = () => {
  return createStore<PipelinesPageState>()((set, get, api) => ({
    ...createPipelinesPageSlice(set, get, api),
  }));
};

export const PipelinesPageStoreContext = createContext<PipelinesPageStore | null>(null);

export const usePipelinesPageStore = () => {
  const context = useContext(PipelinesPageStoreContext);
  if (!context) {
    throw new Error("usePipelinesPageStore must be used within a PipelinesPageStoreProvider");
  }

  return context;
};
