import { createContext, useContext } from "react";
import { createStore } from "zustand";
import {
  createOperationCreatePageSlice,
  type OperationCreatePageSlice,
} from "./operationCreatePageSlice";

export const createOperationCreatePageStore = () => {
  return createStore<OperationCreatePageSlice>()((set, get, api) => ({
    ...createOperationCreatePageSlice(set, get, api),
  }));
};

export const OperationCreatePageStoreContext = createContext<ReturnType<
  typeof createOperationCreatePageStore
> | null>(null);

export const useOperationCreatePageStore = () => {
  const context = useContext(OperationCreatePageStoreContext);
  if (!context) {
    throw new Error(
      "useOperationCreatePageStore must be used within a OperationCreatePageStoreProvider",
    );
  }

  return context;
};
