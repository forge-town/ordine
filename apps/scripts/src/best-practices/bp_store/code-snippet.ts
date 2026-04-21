export interface AppLayoutSlice {
  sidebarOpen: boolean;
  handleSetSidebarOpen: (open: boolean) => void;
}

export const createAppLayoutSlice: StateCreator<AppLayoutSlice> = (set) => ({
  sidebarOpen: false,
  handleSetSidebarOpen: (open) => set({ sidebarOpen: open }),
});
