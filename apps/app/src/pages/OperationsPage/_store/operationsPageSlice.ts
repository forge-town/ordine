import type { StateCreator } from "zustand";

type SortKey = "default" | "name-asc" | "name-desc" | "date-asc" | "date-desc";
export type OperationGroupKey =
  | "all"
  | "check"
  | "fix"
  | "scan"
  | "dev"
  | "scrape"
  | "eval"
  | "test"
  | "other";

type ViewMode = "grid" | "list";

export interface OperationsPageSlice {
  searchQuery: string;
  sortBy: SortKey;
  sortOpen: boolean;
  importing: boolean;
  activeGroup: OperationGroupKey;
  viewMode: ViewMode;

  handleSetSearchQuery: (query: string) => void;
  handleSetSortBy: (sort: SortKey) => void;
  handleSetSortOpen: (open: boolean) => void;
  handleToggleSortOpen: () => void;
  handleSetImporting: (importing: boolean) => void;
  handleSetActiveGroup: (group: OperationGroupKey) => void;
  handleSetViewMode: (mode: ViewMode) => void;
}

export const createOperationsPageSlice: StateCreator<OperationsPageSlice> = (set) => ({
  searchQuery: "",
  sortBy: "default",
  sortOpen: false,
  importing: false,
  activeGroup: "all",
  viewMode: "grid",

  handleSetSearchQuery: (query) => set({ searchQuery: query }),
  handleSetSortBy: (sort) => set({ sortBy: sort }),
  handleSetSortOpen: (open) => set({ sortOpen: open }),
  handleToggleSortOpen: () => set((state) => ({ sortOpen: !state.sortOpen })),
  handleSetImporting: (importing) => set({ importing }),
  handleSetActiveGroup: (activeGroup) => set({ activeGroup }),
  handleSetViewMode: (viewMode) => set({ viewMode }),
});
