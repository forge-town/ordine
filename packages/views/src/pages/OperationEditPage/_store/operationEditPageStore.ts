import { createContext, useContext } from "react";
import { createStore } from "zustand";
import {
  createOperationEditPageSlice,
  type OperationEditPageSlice,
} from "./operationEditPageSlice";

export const createOperationEditPageStore = () => {
  return createStore<OperationEditPageSlice>()((set, get, api) => ({
    ...createOperationEditPageSlice(set, get, api),
  }));
};

export const OperationEditPageStoreContext = createContext<ReturnType<
  typeof createOperationEditPageStore
> | null>(null);

export const useOperationEditPageStore = () => {
  const context = useContext(OperationEditPageStoreContext);
  if (!context) {
    throw new Error(
      "useOperationEditPageStore must be used within a OperationEditPageStoreProvider",
    );
  }

  return context;
};
