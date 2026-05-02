import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import {
  createOperationFormSlice,
  type OperationFormSlice,
} from "../../OperationEditPage/_shared/operationFormSlice";

export interface OperationCreatePageState extends OperationFormSlice {}

export type OperationCreatePageStoreSlice<T = OperationCreatePageState> = StateCreator<
  OperationCreatePageState,
  [],
  [],
  T
>;

export type OperationCreatePageStore = StoreApi<OperationCreatePageState>;

export const createOperationCreatePageStore = () => {
  return createStore<OperationCreatePageState>()((set, get, api) => ({
    ...createOperationFormSlice(set, get, api),
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
