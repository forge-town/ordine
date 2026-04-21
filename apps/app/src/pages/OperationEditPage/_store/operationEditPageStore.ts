import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import {
  createOperationEditPageSlice,
  type OperationEditPageSlice,
} from "./operationEditPageSlice";

export interface OperationEditPageState extends OperationEditPageSlice {}

export type OperationEditPageStoreSlice<T = OperationEditPageState> = StateCreator<
  OperationEditPageState,
  [],
  [],
  T
>;

export type OperationEditPageStore = StoreApi<OperationEditPageState>;

export const createOperationEditPageStore = () => {
  return createStore<OperationEditPageState>()((set, get, api) => ({
    ...createOperationEditPageSlice(set, get, api),
  }));
};

export const OperationEditPageStoreContext = createContext<OperationEditPageStore | null>(null);

export const useOperationEditPageStore = () => {
  const context = useContext(OperationEditPageStoreContext);
  if (!context) {
    throw new Error(
      "useOperationEditPageStore must be used within a OperationEditPageStoreProvider"
    );
  }

  return context;
};
