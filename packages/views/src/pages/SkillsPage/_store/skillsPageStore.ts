import { createContext, useContext } from "react";
import { createStore } from "zustand";
import { createSkillsPageSlice, type SkillsPageSlice } from "./skillsPageSlice";

export const createSkillsPageStore = () => {
  return createStore<SkillsPageSlice>()((set, get, api) => ({
    ...createSkillsPageSlice(set, get, api),
  }));
};

export const SkillsPageStoreContext = createContext<ReturnType<
  typeof createSkillsPageStore
> | null>(null);

export const useSkillsPageStore = () => {
  const context = useContext(SkillsPageStoreContext);
  if (!context) {
    throw new Error("useSkillsPageStore must be used within a SkillsPageStoreProvider");
  }

  return context;
};
