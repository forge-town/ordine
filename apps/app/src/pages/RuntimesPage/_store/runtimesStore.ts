import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { createRuntimesPageSlice, type RuntimesPageSlice } from "./runtimesPageSlice";

export interface RuntimesPageState extends RuntimesPageSlice {}

export type RuntimesPageStoreSlice<T = RuntimesPageState> = StateCreator<
  RuntimesPageState,
  [],
  [],
  T
>;

export type RuntimesPageStore = StoreApi<RuntimesPageState>;

export const createRuntimesPageStore = (
  initialRuntimes: AgentRuntimeConfig[] = []
): RuntimesPageStore =>
  createStore<RuntimesPageState>()((set, get, api) => ({
    ...createRuntimesPageSlice(initialRuntimes)(set, get, api),
  }));

export const RuntimesPageStoreContext = createContext<RuntimesPageStore | null>(null);

export const useRuntimesPageStore = () => {
  const context = useContext(RuntimesPageStoreContext);
  if (!context) {
    throw new Error("useRuntimesPageStore must be used within RuntimesPageStoreProvider");
  }

  return context;
};
