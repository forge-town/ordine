import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import { createAgentsPageSlice, type AgentsPageSlice } from "./agentsPageSlice";

export interface AgentsPageState extends AgentsPageSlice {}

export type AgentsPageStoreSlice<T = AgentsPageState> = StateCreator<AgentsPageState, [], [], T>;

export type AgentsPageStore = StoreApi<AgentsPageState>;

export const createAgentsPageStore = () => {
  return createStore<AgentsPageState>()((set, get, api) => ({
    ...createAgentsPageSlice(set, get, api),
  }));
};

export const AgentsPageStoreContext = createContext<AgentsPageStore | null>(null);

export const useAgentsPageStore = () => {
  const context = useContext(AgentsPageStoreContext);
  if (!context) {
    throw new Error("useAgentsPageStore must be used within a AgentsPageStoreProvider");
  }

  return context;
};
