import type { StateCreator } from "zustand";

export type SkillCategory = "all" | "page" | "data" | "state" | "form" | "code-quality";

export interface SkillsPageSlice {
  search: string;
  category: SkillCategory;
  createOperationDialogOpen: boolean;
  selectedSkillId: string | null;

  handleSetSearch: (search: string) => void;
  handleSetCategory: (category: SkillCategory) => void;
  handleCreateOperationClick: (skillId: string) => void;
  handleCreateOperationDialogClose: () => void;
}

export const createSkillsPageSlice: StateCreator<SkillsPageSlice> = (set) => ({
  search: "",
  category: "all",
  createOperationDialogOpen: false,
  selectedSkillId: null,

  handleSetSearch: (search) => set({ search }),
  handleSetCategory: (category) => set({ category }),
  handleCreateOperationClick: (skillId) =>
    set({ createOperationDialogOpen: true, selectedSkillId: skillId }),
  handleCreateOperationDialogClose: () =>
    set({ createOperationDialogOpen: false, selectedSkillId: null }),
});
