import type { StateCreator } from "zustand";
import { SidebarView, type SidebarViewType } from "./sidebarView";

const isPipelinePathname = (pathname: string): boolean =>
  pathname.startsWith("/canvas") || pathname.startsWith("/pipelines");

const CURRENT_PROJECT_STORAGE_KEY = "ordine.sidebar.currentProjectId";
const CAPABILITIES_OPEN_STORAGE_KEY = "ordine.sidebar.capabilitiesOpen";

const readStoredValue = (key: string) => {
  if (globalThis.localStorage === undefined) return null;

  return globalThis.localStorage.getItem(key);
};

const writeStoredValue = (key: string, value: string) => {
  if (globalThis.localStorage === undefined) return;

  globalThis.localStorage.setItem(key, value);
};

const readStoredBoolean = (key: string, fallback: boolean) => {
  const value = readStoredValue(key);
  if (value === null) return fallback;

  return value === "true";
};

const removeStoredValue = (key: string) => {
  if (globalThis.localStorage === undefined) return;

  globalThis.localStorage.removeItem(key);
};

export interface SidebarSlice {
  view: SidebarViewType;
  searchOpen: boolean;
  newPipelineOpen: boolean;
  currentProjectId: string | null;
  capabilitiesOpen: boolean;
  sidebarSearchQuery: string;

  handleSidebarLocationChange: (pathname: string) => void;
  handleSearchDialogOpenChange: (open: boolean) => void;
  handleSidebarMainViewButtonClick: () => void;
  handleSidebarPipelineViewButtonClick: () => void;
  handleSearchButtonClick: () => void;
  handleNewPipelineButtonClick: () => void;
  handleCurrentProjectChange: (projectId: string) => void;
  /** Drop a stale project id that no longer exists in the database. */
  handleCurrentProjectClear: () => void;
  handleCapabilitiesToggle: () => void;
  handleSidebarSearchChange: (value: string) => void;
  handleSidebarSearchClear: () => void;
}

export const createSidebarSlice: StateCreator<SidebarSlice> = (set, get) => ({
  view: SidebarView.Main,
  searchOpen: false,
  newPipelineOpen: false,
  currentProjectId: readStoredValue(CURRENT_PROJECT_STORAGE_KEY),
  capabilitiesOpen: readStoredBoolean(CAPABILITIES_OPEN_STORAGE_KEY, true),
  sidebarSearchQuery: "",

  handleSidebarLocationChange: (pathname) =>
    set({ view: isPipelinePathname(pathname) ? SidebarView.Pipeline : SidebarView.Main }),
  handleSearchDialogOpenChange: (open) => set({ searchOpen: open }),
  handleSidebarMainViewButtonClick: () => set({ view: SidebarView.Main }),
  handleSidebarPipelineViewButtonClick: () => set({ view: SidebarView.Pipeline }),
  handleSearchButtonClick: () => set({ searchOpen: true }),
  handleNewPipelineButtonClick: () => set({ newPipelineOpen: true }),
  handleCurrentProjectChange: (projectId) => {
    writeStoredValue(CURRENT_PROJECT_STORAGE_KEY, projectId);
    set({ currentProjectId: projectId });
  },
  handleCurrentProjectClear: () => {
    removeStoredValue(CURRENT_PROJECT_STORAGE_KEY);
    set({ currentProjectId: null });
  },
  handleCapabilitiesToggle: () => {
    const capabilitiesOpen = !get().capabilitiesOpen;
    writeStoredValue(CAPABILITIES_OPEN_STORAGE_KEY, String(capabilitiesOpen));
    set({ capabilitiesOpen });
  },
  handleSidebarSearchChange: (value) =>
    set({ searchOpen: value.trim().length > 0, sidebarSearchQuery: value }),
  handleSidebarSearchClear: () => set({ searchOpen: false, sidebarSearchQuery: "" }),
});
