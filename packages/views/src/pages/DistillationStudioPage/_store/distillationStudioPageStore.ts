import { createContext, useContext } from "react";
import { createStore } from "zustand";
import {
  createDistillationStudioPageSlice,
  type DistillationStudioPageSlice,
} from "./distillationStudioPageSlice";

export const createDistillationStudioPageStore = () => {
  return createStore<DistillationStudioPageSlice>()((set, get, api) => ({
    ...createDistillationStudioPageSlice(set, get, api),
  }));
};

export const DistillationStudioPageStoreContext = createContext<ReturnType<
  typeof createDistillationStudioPageStore
> | null>(null);

export const useDistillationStudioPageStore = () => {
  const context = useContext(DistillationStudioPageStoreContext);
  if (!context) {
    throw new Error(
      "useDistillationStudioPageStore must be used within a DistillationStudioPageStoreProvider",
    );
  }

  return context;
};
