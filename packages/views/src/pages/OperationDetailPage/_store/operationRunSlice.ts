import type { StateCreator } from "zustand";

export interface OperationRunSlice {
  isRunPanelOpen: boolean;
  handleOpenRunPanelButtonClick: () => void;
  handleCloseRunPanelButtonClick: () => void;
}

export const createOperationRunSlice: StateCreator<OperationRunSlice> = (set) => ({
  isRunPanelOpen: false,
  handleOpenRunPanelButtonClick: () => set({ isRunPanelOpen: true }),
  handleCloseRunPanelButtonClick: () => set({ isRunPanelOpen: false }),
});
