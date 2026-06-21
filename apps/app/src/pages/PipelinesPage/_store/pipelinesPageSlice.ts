import type { StateCreator } from "zustand";

export const PIPELINE_FILTERS = ["All", "Saved Skills", "Drafts", "Scheduled"] as const;
export type PipelineFilter = (typeof PIPELINE_FILTERS)[number];

export interface PipelinesPageSlice {
  activeFilter: PipelineFilter;
  search: string;

  handleFilterChipClick: (filter: PipelineFilter) => void;
  handleSearchInputChange: (value: string) => void;
  handleClearSearchButtonClick: () => void;
}

export const createPipelinesPageSlice: StateCreator<PipelinesPageSlice> = (set) => ({
  activeFilter: "All",
  search: "",

  handleFilterChipClick: (activeFilter) => set({ activeFilter }),
  handleSearchInputChange: (search) => set({ search }),
  handleClearSearchButtonClick: () => set({ search: "" }),
});
