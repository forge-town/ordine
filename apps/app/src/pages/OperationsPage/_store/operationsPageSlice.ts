import type { StateCreator } from "zustand";

type SortKey = "default" | "name-asc" | "name-desc" | "date-asc" | "date-desc";

export interface OperationsPageSlice {
  searchQuery: string;
  sortBy: SortKey;
  sortOpen: boolean;
  importing: boolean;

  handleSetSearchQuery: (query: string) => void;
  handleSetSortBy: (sort: SortKey) => void;
  handleSetSortOpen: (open: boolean) => void;
  handleToggleSortOpen: () => void;
  handleSetImporting: (importing: boolean) => void;
}

export const createOperationsPageSlice: StateCreator<OperationsPageSlice> = (set) => ({
  searchQuery: "",
  sortBy: "default",
  sortOpen: false,
  importing: false,

  handleSetSearchQuery: (query) => set({ searchQuery: query }),
  handleSetSortBy: (sort) => set({ sortBy: sort }),
  handleSetSortOpen: (open) => set({ sortOpen: open }),
  handleToggleSortOpen: () => set((state) => ({ sortOpen: !state.sortOpen })),
  handleSetImporting: (importing) => set({ importing }),
});
