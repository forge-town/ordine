import type { StateCreator } from "zustand";
import type { JobStatus } from "@repo/schemas";

export interface JobsPageSlice {
  search: string;
  statusFilter: JobStatus | "all";

  handleSetSearch: (search: string) => void;
  handleSetStatusFilter: (status: JobStatus | "all") => void;
}

export const createJobsPageSlice: StateCreator<JobsPageSlice> = (set) => ({
  search: "",
  statusFilter: "all",

  handleSetSearch: (search) => set({ search }),
  handleSetStatusFilter: (status) => set({ statusFilter: status }),
});
