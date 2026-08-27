import type { StateCreator } from "zustand";
import { SidebarView, type SidebarViewType } from "./sidebarView";

const isPipelinePathname = (pathname: string): boolean =>
  pathname.startsWith("/canvas") || pathname.startsWith("/pipelines");

const CURRENT_PROJECT_STORAGE_KEY = "ordine.sidebar.currentProjectId";

const readStoredCurrentProjectId = (): string | null => {
  if (globalThis.localStorage === undefined) return null;

  return globalThis.localStorage.getItem(CURRENT_PROJECT_STORAGE_KEY);
};

const writeStoredCurrentProjectId = (value: string | null) => {
  if (globalThis.localStorage === undefined) return;

  if (value === null) {
    globalThis.localStorage.removeItem?.(CURRENT_PROJECT_STORAGE_KEY);
  } else {
    globalThis.localStorage.setItem(CURRENT_PROJECT_STORAGE_KEY, value);
  }
};

export interface SidebarSlice {
  view: SidebarViewType;
  searchOpen: boolean;
  newPipelineOpen: boolean;
  newPipelineWorkspaceVersion: number;
  currentProjectId: string | null;

  handleSidebarLocationChange: (pathname: string) => void;
  handleSearchDialogOpenChange: (open: boolean) => void;
  handleSidebarMainViewButtonClick: () => void;
  handleSidebarPipelineViewButtonClick: () => void;
  handleSearchButtonClick: () => void;
  handleNewPipelineButtonClick: () => void;
  handleNewPipelineWorkspaceReset: () => void;
  setCurrentProjectId: (projectId: string | null) => void;
  syncCurrentProjectId: (projectIds: string[]) => void;
}

export const createSidebarSlice: StateCreator<SidebarSlice> = (set, get) => ({
  view: SidebarView.Main,
  searchOpen: false,
  newPipelineOpen: false,
  newPipelineWorkspaceVersion: 0,
  currentProjectId: readStoredCurrentProjectId(),

  handleSidebarLocationChange: (pathname) =>
    set({ view: isPipelinePathname(pathname) ? SidebarView.Pipeline : SidebarView.Main }),
  handleSearchDialogOpenChange: (open) => set({ searchOpen: open }),
  handleSidebarMainViewButtonClick: () => set({ view: SidebarView.Main }),
  handleSidebarPipelineViewButtonClick: () => set({ view: SidebarView.Pipeline }),
  handleSearchButtonClick: () => set({ searchOpen: true }),
  handleNewPipelineButtonClick: () => set({ newPipelineOpen: true }),
  handleNewPipelineWorkspaceReset: () =>
    set((state) => ({ newPipelineWorkspaceVersion: state.newPipelineWorkspaceVersion + 1 })),
  setCurrentProjectId: (currentProjectId) => {
    writeStoredCurrentProjectId(currentProjectId);
    set({ currentProjectId });
  },
  syncCurrentProjectId: (projectIds) => {
    const currentProjectId = get().currentProjectId;
    if (currentProjectId === null || projectIds.includes(currentProjectId)) return;

    writeStoredCurrentProjectId(null);
    set({ currentProjectId: null });
  },
});
