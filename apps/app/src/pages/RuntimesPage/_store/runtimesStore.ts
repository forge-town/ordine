import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { createRuntimesPageSlice, type RuntimesPageSlice } from "./runtimesPageSlice";

export interface RuntimesState extends RuntimesPageSlice {}

export type RuntimesStoreSlice<T = RuntimesState> = StateCreator<RuntimesState, [], [], T>;

export type RuntimesStore = StoreApi<RuntimesState>;

export const createRuntimesStore = (initialRuntimes: AgentRuntimeConfig[] = []): RuntimesStore =>
  createStore<RuntimesState>()((set, get, api) => ({
    ...createRuntimesPageSlice(initialRuntimes)(set, get, api),
  }));

export const RuntimesStoreContext = createContext<RuntimesStore | null>(null);

export const useRuntimesStore = () => {
  const context = useContext(RuntimesStoreContext);
  if (!context) {
    throw new Error("useRuntimesStore must be used within RuntimesStoreProvider");
  }

  return context;
};
