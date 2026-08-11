import type { StateCreator } from "zustand";
import { SidebarView, type SidebarViewType } from "./sidebarView";

const isPipelinePathname = (pathname: string): boolean =>
  pathname.startsWith("/canvas") || pathname.startsWith("/pipelines");

export interface SidebarSlice {
  view: SidebarViewType;
  searchOpen: boolean;
  newPipelineOpen: boolean;
  newPipelineWorkspaceVersion: number;

  handleSidebarLocationChange: (pathname: string) => void;
  handleSearchDialogOpenChange: (open: boolean) => void;
  handleSidebarMainViewButtonClick: () => void;
  handleSidebarPipelineViewButtonClick: () => void;
  handleSearchButtonClick: () => void;
  handleNewPipelineButtonClick: () => void;
  handleNewPipelineWorkspaceReset: () => void;
}

export const createSidebarSlice: StateCreator<SidebarSlice> = (set) => ({
  view: SidebarView.Main,
  searchOpen: false,
  newPipelineOpen: false,
  newPipelineWorkspaceVersion: 0,

  handleSidebarLocationChange: (pathname) =>
    set({ view: isPipelinePathname(pathname) ? SidebarView.Pipeline : SidebarView.Main }),
  handleSearchDialogOpenChange: (open) => set({ searchOpen: open }),
  handleSidebarMainViewButtonClick: () => set({ view: SidebarView.Main }),
  handleSidebarPipelineViewButtonClick: () => set({ view: SidebarView.Pipeline }),
  handleSearchButtonClick: () => set({ searchOpen: true }),
  handleNewPipelineButtonClick: () => set({ newPipelineOpen: true }),
  handleNewPipelineWorkspaceReset: () =>
    set((state) => ({ newPipelineWorkspaceVersion: state.newPipelineWorkspaceVersion + 1 })),
});
