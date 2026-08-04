import type { StateCreator } from "zustand";
import { SidebarView, type SidebarViewType } from "./sidebarView";

const isPipelinePathname = (pathname: string): boolean =>
  pathname.startsWith("/canvas") || pathname.startsWith("/pipelines");

const CAPABILITIES_OPEN_STORAGE_KEY = "ordine.sidebar.capabilitiesOpen";

const readStoredCapabilitiesOpen = () => {
  if (globalThis.localStorage === undefined) return true;

  const value = globalThis.localStorage.getItem(CAPABILITIES_OPEN_STORAGE_KEY);

  return value === null ? true : value === "true";
};

const writeStoredCapabilitiesOpen = (value: boolean) => {
  if (globalThis.localStorage === undefined) return;

  globalThis.localStorage.setItem(CAPABILITIES_OPEN_STORAGE_KEY, String(value));
};

export interface SidebarSlice {
  view: SidebarViewType;
  searchOpen: boolean;
  newPipelineOpen: boolean;
  capabilitiesOpen: boolean;

  handleSidebarLocationChange: (pathname: string) => void;
  handleSearchDialogOpenChange: (open: boolean) => void;
  handleSidebarMainViewButtonClick: () => void;
  handleSidebarPipelineViewButtonClick: () => void;
  handleSearchButtonClick: () => void;
  handleNewPipelineButtonClick: () => void;
  handleCapabilitiesToggle: () => void;
}

export const createSidebarSlice: StateCreator<SidebarSlice> = (set, get) => ({
  view: SidebarView.Main,
  searchOpen: false,
  newPipelineOpen: false,
  capabilitiesOpen: readStoredCapabilitiesOpen(),

  handleSidebarLocationChange: (pathname) =>
    set({ view: isPipelinePathname(pathname) ? SidebarView.Pipeline : SidebarView.Main }),
  handleSearchDialogOpenChange: (open) => set({ searchOpen: open }),
  handleSidebarMainViewButtonClick: () => set({ view: SidebarView.Main }),
  handleSidebarPipelineViewButtonClick: () => set({ view: SidebarView.Pipeline }),
  handleSearchButtonClick: () => set({ searchOpen: true }),
  handleNewPipelineButtonClick: () => set({ newPipelineOpen: true }),
  handleCapabilitiesToggle: () => {
    const capabilitiesOpen = !get().capabilitiesOpen;
    writeStoredCapabilitiesOpen(capabilitiesOpen);
    set({ capabilitiesOpen });
  },
});
