import { createContext, useContext } from "react";
import { createStore } from "zustand";
import { createRuntimesPageSlice, type RuntimesPageSlice } from "./runtimesPageSlice";

export const createRuntimesPageStore = () => {
  return createStore<RuntimesPageSlice>()((set, get, api) => ({
    ...createRuntimesPageSlice(set, get, api),
  }));
};

export const RuntimesPageStoreContext = createContext<ReturnType<
  typeof createRuntimesPageStore
> | null>(null);

export const useRuntimesPageStore = (): ReturnType<typeof createRuntimesPageStore> => {
  const context = useContext(RuntimesPageStoreContext);
  if (!context) {
    throw new Error("useRuntimesPageStore must be used within a RuntimesPageStoreProvider");
  }

  return context;
};
