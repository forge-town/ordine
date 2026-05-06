import type { StateCreator } from "zustand";
import type { AgentRuntimeConfig } from "@repo/schemas";

export interface ScanDiff {
  added: AgentRuntimeConfig[];
  removed: AgentRuntimeConfig[];
  unchanged: AgentRuntimeConfig[];
}

export interface RuntimesPageSlice {
  scanDiff: ScanDiff | null;
  isScanning: boolean;

  setScanDiff: (diff: ScanDiff | null) => void;
  setIsScanning: (value: boolean) => void;
  closeScanModal: () => void;
}

export const createRuntimesPageSlice: StateCreator<RuntimesPageSlice> = (set) => ({
  scanDiff: null,
  isScanning: false,

  setScanDiff: (diff) => set({ scanDiff: diff }),
  setIsScanning: (value) => set({ isScanning: value }),
  closeScanModal: () => set({ scanDiff: null }),
});
