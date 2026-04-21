import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import {
  createOperationCreatePageSlice,
  type OperationCreatePageSlice,
} from "./operationCreatePageSlice";

export interface OperationCreatePageState extends OperationCreatePageSlice {}

export type OperationCreatePageStoreSlice<T = OperationCreatePageState> = StateCreator<
  OperationCreatePageState,
  [],
  [],
  T
>;

export type OperationCreatePageStore = StoreApi<OperationCreatePageState>;

export const createOperationCreatePageStore = () => {
  return createStore<OperationCreatePageState>()((set, get, api) => ({
    ...createOperationCreatePageSlice(set, get, api),
  }));
};

export const OperationCreatePageStoreContext = createContext<OperationCreatePageStore | null>(null);

export const useOperationCreatePageStore = () => {
  const context = useContext(OperationCreatePageStoreContext);
  if (!context) {
    throw new Error(
      "useOperationCreatePageStore must be used within a OperationCreatePageStoreProvider"
    );
  }

  return context;
};
