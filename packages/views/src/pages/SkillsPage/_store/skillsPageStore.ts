import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import { createSkillsPageSlice, type SkillsPageSlice } from "./skillsPageSlice";

export interface SkillsPageState extends SkillsPageSlice {}

export type SkillsPageStoreSlice<T = SkillsPageState> = StateCreator<SkillsPageState, [], [], T>;

export type SkillsPageStore = StoreApi<SkillsPageState>;

export const createSkillsPageStore = () => {
  return createStore<SkillsPageState>()((set, get, api) => ({
    ...createSkillsPageSlice(set, get, api),
  }));
};

export const SkillsPageStoreContext = createContext<SkillsPageStore | null>(null);

export const useSkillsPageStore = () => {
  const context = useContext(SkillsPageStoreContext);
  if (!context) {
    throw new Error("useSkillsPageStore must be used within a SkillsPageStoreProvider");
  }

  return context;
};
