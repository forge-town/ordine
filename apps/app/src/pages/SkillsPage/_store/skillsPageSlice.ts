import type { StateCreator } from "zustand";

export const SKILL_SOURCE_FILTERS = [
  "All",
  "Claude Code",
  "Codex",
  "Hermes",
  "Imported",
  "Custom",
  "Built-in",
] as const;

export type SkillSourceFilter = (typeof SKILL_SOURCE_FILTERS)[number];

export interface SkillsPageSlice {
  search: string;
  source: SkillSourceFilter;
  createOperationDialogOpen: boolean;
  selectedSkillId: string | null;

  handleSetSearch: (search: string) => void;
  handleSetSource: (source: SkillSourceFilter) => void;
  handleCreateOperationClick: (skillId: string) => void;
  handleCreateOperationDialogClose: () => void;
}

export const createSkillsPageSlice: StateCreator<SkillsPageSlice> = (set) => ({
  search: "",
  source: "All",
  createOperationDialogOpen: false,
  selectedSkillId: null,

  handleSetSearch: (search) => set({ search }),
  handleSetSource: (source) => set({ source }),
  handleCreateOperationClick: (skillId) =>
    set({ createOperationDialogOpen: true, selectedSkillId: skillId }),
  handleCreateOperationDialogClose: () =>
    set({ createOperationDialogOpen: false, selectedSkillId: null }),
});
