import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import { createAgentDetailPageSlice, type AgentDetailPageSlice } from "./agentDetailPageSlice";

export interface AgentDetailPageState extends AgentDetailPageSlice {}

export type AgentDetailPageStoreSlice<T = AgentDetailPageState> = StateCreator<
  AgentDetailPageState,
  [],
  [],
  T
>;

export type AgentDetailPageStore = StoreApi<AgentDetailPageState>;

export const createAgentDetailPageStore = () => {
  return createStore<AgentDetailPageState>()((set, get, api) => ({
    ...createAgentDetailPageSlice(set, get, api),
  }));
};

export const AgentDetailPageStoreContext = createContext<AgentDetailPageStore | null>(null);

export const useAgentDetailPageStore = () => {
  const context = useContext(AgentDetailPageStoreContext);
  if (!context) {
    throw new Error("useAgentDetailPageStore must be used within a AgentDetailPageStoreProvider");
  }

  return context;
};
