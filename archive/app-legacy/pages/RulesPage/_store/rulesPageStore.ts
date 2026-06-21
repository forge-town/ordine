import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import { createRulesPageSlice, type RulesPageSlice } from "./rulesPageSlice";

export interface RulesPageState extends RulesPageSlice {}

export type RulesPageStoreSlice<T = RulesPageState> = StateCreator<RulesPageState, [], [], T>;

export type RulesPageStore = StoreApi<RulesPageState>;

export const createRulesPageStore = () => {
  return createStore<RulesPageState>()((set, get, api) => ({
    ...createRulesPageSlice(set, get, api),
  }));
};

export const RulesPageStoreContext = createContext<RulesPageStore | null>(null);

export const useRulesPageStore = () => {
  const context = useContext(RulesPageStoreContext);
  if (!context) {
    throw new Error("useRulesPageStore must be used within a RulesPageStoreProvider");
  }

  return context;
};
