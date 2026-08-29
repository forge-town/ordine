import { createContext, useContext } from "react";
import { createStore } from "zustand";
import { createAgentDetailPageSlice, type AgentDetailPageSlice } from "./agentDetailPageSlice";

export const createAgentDetailPageStore = () => {
  return createStore<AgentDetailPageSlice>()((set, get, api) => ({
    ...createAgentDetailPageSlice(set, get, api),
  }));
};

export const AgentDetailPageStoreContext = createContext<ReturnType<
  typeof createAgentDetailPageStore
> | null>(null);

export const useAgentDetailPageStore = () => {
  const context = useContext(AgentDetailPageStoreContext);
  if (!context) {
    throw new Error("useAgentDetailPageStore must be used within a AgentDetailPageStoreProvider");
  }

  return context;
};
