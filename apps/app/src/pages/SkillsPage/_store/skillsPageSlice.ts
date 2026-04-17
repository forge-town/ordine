import type { StateCreator } from "zustand";

type SkillCategory = "all" | "page" | "data" | "state" | "form" | "code-quality";

export interface SkillsPageSlice {
  search: string;
  category: SkillCategory;

  handleSetSearch: (search: string) => void;
  handleSetCategory: (category: SkillCategory) => void;
}

export const createSkillsPageSlice: StateCreator<SkillsPageSlice> = (set) => ({
  search: "",
  category: "all",

  handleSetSearch: (search) => set({ search }),
  handleSetCategory: (category) => set({ category }),
});
