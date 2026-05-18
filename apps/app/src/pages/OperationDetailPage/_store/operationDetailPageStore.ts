import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import {
  createOperationDetailPageSlice,
  type OperationDetailPageSlice,
} from "./operationDetailPageSlice";
import { createOperationRunSlice, type OperationRunSlice } from "./operationRunSlice";

export interface OperationDetailPageState extends OperationDetailPageSlice, OperationRunSlice {}

export type OperationDetailPageStoreSlice<T = OperationDetailPageState> = StateCreator<
  OperationDetailPageState,
  [],
  [],
  T
>;

export type OperationDetailPageStore = StoreApi<OperationDetailPageState>;

export const createOperationDetailPageStore = () => {
  return createStore<OperationDetailPageState>()((set, get, api) => ({
    ...createOperationDetailPageSlice(set, get, api),
    ...createOperationRunSlice(set, get, api),
  }));
};

export const OperationDetailPageStoreContext = createContext<OperationDetailPageStore | null>(null);

export const useOperationDetailPageStore = () => {
  const context = useContext(OperationDetailPageStoreContext);
  if (!context) {
    throw new Error(
      "useOperationDetailPageStore must be used within a OperationDetailPageStoreProvider",
    );
  }

  return context;
};
