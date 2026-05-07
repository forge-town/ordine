import type { StateCreator } from "zustand";

export interface ProjectsPageSlice {
  search: string;
  showCreate: boolean;

  handleSetSearch: (search: string) => void;
  handleSetShowCreate: (show: boolean) => void;
}

export const createProjectsPageSlice: StateCreator<ProjectsPageSlice> = (set) => ({
  search: "",
  showCreate: false,

  handleSetSearch: (search) => set({ search }),
  handleSetShowCreate: (show) => set({ showCreate: show }),
});
