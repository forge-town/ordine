import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import { createRuntimesPageSlice, type RuntimesPageSlice } from "./runtimesPageSlice";

export interface RuntimesPageState extends RuntimesPageSlice {}

export type RuntimesPageStoreSlice<T = RuntimesPageState> = StateCreator<RuntimesPageState, [], [], T>;

export type RuntimesPageStore = StoreApi<RuntimesPageState>;

export const createRuntimesPageStore = () => {
  return createStore<RuntimesPageState>()((set, get, api) => ({
    ...createRuntimesPageSlice(set, get, api),
  }));
};

export const RuntimesPageStoreContext = createContext<RuntimesPageStore | null>(null);

export const useRuntimesPageStore = (): RuntimesPageStore => {
  const context = useContext(RuntimesPageStoreContext);
  if (!context) {
    throw new Error("useRuntimesPageStore must be used within a RuntimesPageStoreProvider");
  }

  return context;
};
