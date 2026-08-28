import { createContext, useContext } from "react";
import { createStore } from "zustand";
import { createOperationsPageSlice, type OperationsPageSlice } from "./operationsPageSlice";

export const createOperationsPageStore = () => {
  return createStore<OperationsPageSlice>()((set, get, api) => ({
    ...createOperationsPageSlice(set, get, api),
  }));
};

export const OperationsPageStoreContext = createContext<ReturnType<
  typeof createOperationsPageStore
> | null>(null);

export const useOperationsPageStore = () => {
  const context = useContext(OperationsPageStoreContext);
  if (!context) {
    throw new Error("useOperationsPageStore must be used within a OperationsPageStoreProvider");
  }

  return context;
};
