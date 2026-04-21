import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import {
  createBestPracticesPageSlice,
  type BestPracticesPageSlice,
} from "./bestPracticesPageSlice";
import { createImportSlice, type ImportSlice } from "./importSlice";

export interface BestPracticesPageState extends BestPracticesPageSlice, ImportSlice {}

export type BestPracticesPageStoreSlice<T = BestPracticesPageState> = StateCreator<
  BestPracticesPageState,
  [],
  [],
  T
>;

export type BestPracticesPageStore = StoreApi<BestPracticesPageState>;

export const createBestPracticesPageStore = () => {
  return createStore<BestPracticesPageState>()((set, get, api) => ({
    ...createBestPracticesPageSlice(set, get, api),
    ...createImportSlice(set, get, api),
  }));
};

export const BestPracticesPageStoreContext = createContext<BestPracticesPageStore | null>(null);

export const useBestPracticesPageStore = () => {
  const context = useContext(BestPracticesPageStoreContext);
  if (!context) {
    throw new Error(
      "useBestPracticesPageStore must be used within a BestPracticesPageStoreProvider"
    );
  }

  return context;
};
