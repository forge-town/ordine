import type { ChangeEvent } from "react";
import type { StateCreator } from "zustand";

export interface PipelinesPageSlice {
  search: string;
  selectedTags: string[];
  activeFilter: PipelineFilter;

  handleSearchInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleClearSearchButtonClick: () => void;
  handleTagBadgeClick: (tag: string) => void;
  handleClearTagsButtonClick: () => void;
  handleFilterChange: (filter: PipelineFilter) => void;
}

export const PIPELINE_FILTERS = ["all", "savedSkills", "drafts", "scheduled"] as const;
export type PipelineFilter = (typeof PIPELINE_FILTERS)[number];

export const createPipelinesPageSlice: StateCreator<PipelinesPageSlice> = (set) => ({
  search: "",
  selectedTags: [],
  activeFilter: "all",

  handleSearchInputChange: (event) => set({ search: event.target.value }),
  handleClearSearchButtonClick: () => set({ search: "" }),
  handleTagBadgeClick: (tag) =>
    set((state) => ({
      selectedTags: state.selectedTags.includes(tag)
        ? state.selectedTags.filter((t) => t !== tag)
        : [...state.selectedTags, tag],
    })),
  handleClearTagsButtonClick: () => set({ selectedTags: [] }),
  handleFilterChange: (activeFilter) => set({ activeFilter }),
});
