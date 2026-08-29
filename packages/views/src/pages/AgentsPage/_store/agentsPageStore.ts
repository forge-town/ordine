import { createContext, useContext } from "react";
import { createStore } from "zustand";
import { createAgentsPageSlice, type AgentsPageSlice } from "./agentsPageSlice";

export const createAgentsPageStore = () => {
  return createStore<AgentsPageSlice>()((set, get, api) => ({
    ...createAgentsPageSlice(set, get, api),
  }));
};

export const AgentsPageStoreContext = createContext<ReturnType<
  typeof createAgentsPageStore
> | null>(null);

export const useAgentsPageStore = () => {
  const context = useContext(AgentsPageStoreContext);
  if (!context) {
    throw new Error("useAgentsPageStore must be used within a AgentsPageStoreProvider");
  }

  return context;
};
