import type { ChangeEvent } from "react";
import type { StateCreator } from "zustand";

type SkillCategory = "all" | "page" | "data" | "state" | "form" | "code-quality";

export interface SkillsPageSlice {
  search: string;
  category: SkillCategory;

  handleSearchInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleCategoryButtonClick: (category: SkillCategory) => void;
}

export const createSkillsPageSlice: StateCreator<SkillsPageSlice> = (set) => ({
  search: "",
  category: "all",

  handleSearchInputChange: (event) => set({ search: event.target.value }),
  handleCategoryButtonClick: (category) => set({ category }),
});
