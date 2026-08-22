import { ResultAsync } from "neverthrow";
import type { StateCreator } from "zustand";
import type { AgentRuntimeCatalogEntry } from "@repo/schemas";

export interface RuntimesPageSlice {
  connectionTestRuntimeConfigId: string | null;
  isScanning: boolean;
  scanFailed: boolean;
  scannedRuntimeCount: number | null;
  handleConnectionTestOpenChange: (runtimeConfigId: string | null) => void;
  handleRescanButtonClick: (
    rescanCatalog: () => Promise<AgentRuntimeCatalogEntry[]>,
  ) => Promise<boolean>;
}

export const createRuntimesPageSlice: StateCreator<RuntimesPageSlice> = (set) => ({
  connectionTestRuntimeConfigId: null,
  isScanning: false,
  scanFailed: false,
  scannedRuntimeCount: null,

  handleConnectionTestOpenChange: (connectionTestRuntimeConfigId) => {
    set({ connectionTestRuntimeConfigId });
  },

  handleRescanButtonClick: async (rescanCatalog) => {
    set({ isScanning: true, scanFailed: false });
    const result = await ResultAsync.fromPromise(rescanCatalog(), () => undefined);
    if (result.isErr()) {
      set({ isScanning: false, scanFailed: true });

      return false;
    }
    set({
      isScanning: false,
      scanFailed: false,
      scannedRuntimeCount: result.value.length,
    });

    return true;
  },
});
