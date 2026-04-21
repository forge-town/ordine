import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import { createOperationsPageSlice, type OperationsPageSlice } from "./operationsPageSlice";

export interface OperationsPageState extends OperationsPageSlice {}

export type OperationsPageStoreSlice<T = OperationsPageState> = StateCreator<
  OperationsPageState,
  [],
  [],
  T
>;

export type OperationsPageStore = StoreApi<OperationsPageState>;

export const createOperationsPageStore = () => {
  return createStore<OperationsPageState>()((set, get, api) => ({
    ...createOperationsPageSlice(set, get, api),
  }));
};

export const OperationsPageStoreContext = createContext<OperationsPageStore | null>(null);

export const useOperationsPageStore = () => {
  const context = useContext(OperationsPageStoreContext);
  if (!context) {
    throw new Error("useOperationsPageStore must be used within a OperationsPageStoreProvider");
  }

  return context;
};
