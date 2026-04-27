import type { StateCreator } from "zustand";
import type { RuleCategory } from "@repo/schemas";

export interface RulesPageSlice {
  categoryFilter: RuleCategory | "all";
  search: string;

  handleSetCategoryFilter: (category: RuleCategory | "all") => void;
  handleSetSearch: (search: string) => void;
}

export const createRulesPageSlice: StateCreator<RulesPageSlice> = (set) => ({
  categoryFilter: "all",
  search: "",

  handleSetCategoryFilter: (category) => set({ categoryFilter: category }),
  handleSetSearch: (search) => set({ search }),
});
