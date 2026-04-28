import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import {
  createDistillationStudioPageSlice,
  type DistillationStudioPageSlice,
} from "./distillationStudioPageSlice";

export interface DistillationStudioPageState extends DistillationStudioPageSlice {}

export type DistillationStudioPageStoreSlice<T = DistillationStudioPageState> = StateCreator<
  DistillationStudioPageState,
  [],
  [],
  T
>;

export type DistillationStudioPageStore = StoreApi<DistillationStudioPageState>;

export const createDistillationStudioPageStore = () => {
  return createStore<DistillationStudioPageState>()((set, get, api) => ({
    ...createDistillationStudioPageSlice(set, get, api),
  }));
};

export const DistillationStudioPageStoreContext = createContext<DistillationStudioPageStore | null>(
  null
);

export const useDistillationStudioPageStore = () => {
  const context = useContext(DistillationStudioPageStoreContext);
  if (!context) {
    throw new Error(
      "useDistillationStudioPageStore must be used within a DistillationStudioPageStoreProvider"
    );
  }

  return context;
};
