import type { StateCreator } from "zustand";

export interface PipelinesPageSlice {
  search: string;
  selectedTags: string[];

  handleSetSearch: (search: string) => void;
  handleSetSelectedTags: (tags: string[]) => void;
  handleToggleTag: (tag: string) => void;
  handleClearTags: () => void;
}

export const createPipelinesPageSlice: StateCreator<PipelinesPageSlice> = (set) => ({
  search: "",
  selectedTags: [],

  handleSetSearch: (search) => set({ search }),
  handleSetSelectedTags: (tags) => set({ selectedTags: tags }),
  handleToggleTag: (tag) =>
    set((state) => ({
      selectedTags: state.selectedTags.includes(tag)
        ? state.selectedTags.filter((t) => t !== tag)
        : [...state.selectedTags, tag],
    })),
  handleClearTags: () => set({ selectedTags: [] }),
});
