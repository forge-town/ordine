import { createContext, useContext } from "react";
import { createStore } from "zustand";
import { createPipelinesPageSlice, type PipelinesPageSlice } from "./pipelinesPageSlice";

export const createPipelinesPageStore = () => {
  return createStore<PipelinesPageSlice>()((set, get, api) => ({
    ...createPipelinesPageSlice(set, get, api),
  }));
};

export const PipelinesPageStoreContext = createContext<ReturnType<
  typeof createPipelinesPageStore
> | null>(null);

export const usePipelinesPageStore = () => {
  const context = useContext(PipelinesPageStoreContext);
  if (!context) {
    throw new Error("usePipelinesPageStore must be used within a PipelinesPageStoreProvider");
  }

  return context;
};
