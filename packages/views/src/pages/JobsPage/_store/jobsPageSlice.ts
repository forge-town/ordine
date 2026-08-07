import type { StateCreator } from "zustand";
export const JOB_STATUS_FILTERS = ["All", "Running", "Waiting", "Completed", "Failed"] as const;
export type JobStatusFilter = (typeof JOB_STATUS_FILTERS)[number];

export interface JobsPageSlice {
  search: string;
  statusFilter: JobStatusFilter;

  handleSearchInputChange: (value: string) => void;
  handleSearchClearButtonClick: () => void;
  handleStatusFilterButtonClick: (status: JobStatusFilter) => void;
}

export const createJobsPageSlice: StateCreator<JobsPageSlice> = (set) => ({
  search: "",
  statusFilter: "All",

  handleSearchInputChange: (search) => set({ search }),
  handleSearchClearButtonClick: () => set({ search: "" }),
  handleStatusFilterButtonClick: (status) => set({ statusFilter: status }),
});
