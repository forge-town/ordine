import type { StateCreator } from "zustand";

export interface BestPracticesPageSlice {
  search: string;
  activeCategory: string;
  showForm: boolean;

  handleSetSearch: (search: string) => void;
  handleSetActiveCategory: (category: string) => void;
  handleSetShowForm: (show: boolean) => void;
}

export const createBestPracticesPageSlice: StateCreator<BestPracticesPageSlice> = (set) => ({
  search: "",
  activeCategory: "all",
  showForm: false,

  handleSetSearch: (search) => set({ search }),
  handleSetActiveCategory: (category) => set({ activeCategory: category }),
  handleSetShowForm: (show) => set({ showForm: show }),
});
