import type { StateCreator } from "zustand";
import type { JobStatus } from "@repo/schemas";

export interface JobsPageSlice {
  search: string;
  statusFilter: JobStatus | "all";

  handleSearchInputChange: (value: string) => void;
  handleStatusFilterButtonClick: (status: JobStatus | "all") => void;
}

export const createJobsPageSlice: StateCreator<JobsPageSlice> = (set) => ({
  search: "",
  statusFilter: "all",

  handleSearchInputChange: (search) => set({ search }),
  handleStatusFilterButtonClick: (status) => set({ statusFilter: status }),
});
