import type { ChangeEvent } from "react";
import type { StateCreator } from "zustand";
import type { JobStatus } from "@repo/schemas";

export interface JobsPageSlice {
  search: string;
  statusFilter: JobStatus | "all";

  handleSearchInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleStatusFilterButtonClick: (status: JobStatus | "all") => void;
}

export const createJobsPageSlice: StateCreator<JobsPageSlice> = (set) => ({
  search: "",
  statusFilter: "all",

  handleSearchInputChange: (event) => set({ search: event.target.value }),
  handleStatusFilterButtonClick: (status) => set({ statusFilter: status }),
});
