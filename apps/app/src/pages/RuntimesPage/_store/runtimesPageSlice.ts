import type { StateCreator } from "zustand";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { dataProvider, ResourceName } from "@/integrations/refine/dataProvider";

export interface ScanDiff {
  added: AgentRuntimeConfig[];
  removed: AgentRuntimeConfig[];
  unchanged: AgentRuntimeConfig[];
}

interface DetectedRuntime {
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

  handleScanButtonClick: (existingRuntimes: AgentRuntimeConfig[]) => Promise<void>;
  handleConfirmSyncButtonClick: () => Promise<void>;
  handleScanDiffModalOpenChange: (open: boolean) => void;
}

export const createRuntimesPageSlice: StateCreator<RuntimesPageSlice> = (set, get) => ({
  scanDiff: null,
  isScanning: false,

  handleScanButtonClick: async (existingRuntimes) => {
    set({ isScanning: true });
    const result = await dataProvider.custom!<DetectedRuntime[]>({
      method: "get",
      url: "settings/scanRuntimes",
    });
    const detected = result.data;
    const diff = computeDiff(existingRuntimes, detected);
    set({ scanDiff: diff, isScanning: false });
  },

  handleConfirmSyncButtonClick: async () => {
    const diff = get().scanDiff;
    if (!diff) return;
    for (const item of diff.added) {
      await dataProvider.create({
        resource: ResourceName.agentRuntimes,
        variables: item,
      });
    }
    for (const item of diff.removed) {
      await dataProvider.deleteOne({
        resource: ResourceName.agentRuntimes,
        id: item.id,
      });
    }
    set({ scanDiff: null });
  },

  handleScanDiffModalOpenChange: (open) => {
    if (!open) set({ scanDiff: null });
  },
});
