import type { ChangeEvent } from "react";
import type { StateCreator } from "zustand";

export interface PipelinesPageSlice {
  search: string;
  selectedTags: string[];

  handleSearchInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleClearSearchButtonClick: () => void;
  handleTagBadgeClick: (tag: string) => void;
  handleClearTagsButtonClick: () => void;
}

export const createPipelinesPageSlice: StateCreator<PipelinesPageSlice> = (set) => ({
  search: "",
  selectedTags: [],

  handleSearchInputChange: (event) => set({ search: event.target.value }),
  handleClearSearchButtonClick: () => set({ search: "" }),
  handleTagBadgeClick: (tag) =>
    set((state) => ({
      selectedTags: state.selectedTags.includes(tag)
        ? state.selectedTags.filter((t) => t !== tag)
        : [...state.selectedTags, tag],
    })),
  handleClearTagsButtonClick: () => set({ selectedTags: [] }),
});
