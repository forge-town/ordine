import type { StateCreator } from "zustand";

export const SidebarView = {
  Main: "main",
  Pipeline: "pipeline",
} as const;

export type SidebarViewType = (typeof SidebarView)[keyof typeof SidebarView];

export interface SidebarSlice {
  view: SidebarViewType;
  searchOpen: boolean;
  newPipelineOpen: boolean;

  setView: (view: SidebarViewType) => void;
  setSearchOpen: (open: boolean) => void;
  setNewPipelineOpen: (open: boolean) => void;
  handleShowMainView: () => void;
  handleShowPipelineView: () => void;
  handleOpenSearch: () => void;
  handleOpenNewPipeline: () => void;
}

export const createSidebarSlice: StateCreator<SidebarSlice> = (set) => ({
  view: SidebarView.Main,
  searchOpen: false,
  newPipelineOpen: false,

  setView: (view) => set({ view }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setNewPipelineOpen: (open) => set({ newPipelineOpen: open }),
  handleShowMainView: () => set({ view: SidebarView.Main }),
  handleShowPipelineView: () => set({ view: SidebarView.Pipeline }),
  handleOpenSearch: () => set({ searchOpen: true }),
  handleOpenNewPipeline: () => set({ newPipelineOpen: true }),
});
