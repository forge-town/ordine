import type { StateCreator } from "zustand";
import type { AgentRuntimeConfig } from "@repo/schemas";

export interface ScanDiff {
  added: AgentRuntimeConfig[];
  removed: AgentRuntimeConfig[];
  unchanged: AgentRuntimeConfig[];
}

export interface DetectedRuntime {
  type: string;
  binaryName: string;
  path: string;
  version?: string;
}

const computeDiff = (existing: AgentRuntimeConfig[], detected: DetectedRuntime[]): ScanDiff => {
  const detectedIds = new Set(detected.map((d) => `local-${d.type}`));
  const existingIds = new Set(existing.map((e) => e.id));

  const added: AgentRuntimeConfig[] = detected
    .filter((d) => !existingIds.has(`local-${d.type}`))
    .map((d) => ({
      id: `local-${d.type}`,
      name: d.type,
      type: d.type as AgentRuntimeConfig["type"],
      connection: { mode: "local" as const },
    }));

  const removed = existing.filter((e) => e.id.startsWith("local-") && !detectedIds.has(e.id));
  const unchanged = existing.filter((e) => detectedIds.has(e.id));

  return { added, removed, unchanged };
};

export interface RuntimesPageSlice {
  scanDiff: ScanDiff | null;
  isScanning: boolean;

  handleScanButtonClick: (
    existingRuntimes: AgentRuntimeConfig[],
    scanRuntimes: () => Promise<DetectedRuntime[]>,
  ) => Promise<void>;
  handleConfirmSyncButtonClick: (dependencies: {
    createRuntime: (values: AgentRuntimeConfig) => Promise<unknown>;
    deleteRuntime: (id: string) => Promise<unknown>;
  }) => Promise<void>;
  handleScanDiffModalOpenChange: (open: boolean) => void;
}

export const createRuntimesPageSlice: StateCreator<RuntimesPageSlice> = (set, get) => ({
  scanDiff: null,
  isScanning: false,

  handleScanButtonClick: async (existingRuntimes, scanRuntimes) => {
    set({ isScanning: true });
    const detected = await scanRuntimes();
    const diff = computeDiff(existingRuntimes, detected);
    set({ scanDiff: diff, isScanning: false });
  },

  handleConfirmSyncButtonClick: async (dependencies) => {
    const diff = get().scanDiff;
    if (!diff) return;
    for (const item of diff.added) {
      await dependencies.createRuntime(item);
    }
    for (const item of diff.removed) {
      await dependencies.deleteRuntime(item.id);
    }
    set({ scanDiff: null });
  },

  handleScanDiffModalOpenChange: (open) => {
    if (!open) set({ scanDiff: null });
  },
});
