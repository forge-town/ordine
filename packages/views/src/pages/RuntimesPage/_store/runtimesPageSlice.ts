import type { StateCreator } from "zustand";
import { ResultAsync } from "neverthrow";
import type { AgentRuntimeConfig, DetectedRuntime as SchemaDetectedRuntime } from "@repo/schemas";

export interface ScanDiff {
  added: AgentRuntimeConfig[];
  updated: AgentRuntimeConfig[];
  removed: AgentRuntimeConfig[];
  unchanged: AgentRuntimeConfig[];
}

export type DetectedRuntime = Omit<SchemaDetectedRuntime, "type"> & { type: string };

const makeDetectedRuntimeConfig = (
  detected: DetectedRuntime,
  existing?: AgentRuntimeConfig,
): AgentRuntimeConfig => ({
  id: `local-${detected.type}`,
  name: existing?.name ?? detected.type,
  type: detected.type as AgentRuntimeConfig["type"],
  connection: {
    mode: "local",
    binaryName: detected.binaryName,
    path: detected.path,
    version: detected.version,
    ...(detected.models === undefined ? {} : { models: detected.models }),
    detectedAt: new Date().toISOString(),
  },
});

const hasDetectionChanged = (
  existing: AgentRuntimeConfig,
  detected: AgentRuntimeConfig,
): boolean => {
  if (existing.connection.mode !== "local" || detected.connection.mode !== "local") return true;

  const modelsChanged =
    detected.connection.models !== undefined &&
    JSON.stringify(existing.connection.models ?? []) !== JSON.stringify(detected.connection.models);

  return (
    existing.type !== detected.type ||
    existing.connection.binaryName !== detected.connection.binaryName ||
    existing.connection.path !== detected.connection.path ||
    existing.connection.version !== detected.connection.version ||
    modelsChanged
  );
};

export const computeDiff = (
  existing: AgentRuntimeConfig[],
  detected: DetectedRuntime[],
): ScanDiff => {
  const detectedIds = new Set(detected.map((d) => `local-${d.type}`));
  const existingById = new Map(existing.map((runtime) => [runtime.id, runtime]));
  const detectedConfigs = detected.map((runtime) =>
    makeDetectedRuntimeConfig(runtime, existingById.get(`local-${runtime.type}`)),
  );

  const added = detectedConfigs.filter((runtime) => !existingById.has(runtime.id));
  const updated = detectedConfigs.filter((runtime) => {
    const savedRuntime = existingById.get(runtime.id);

    return savedRuntime ? hasDetectionChanged(savedRuntime, runtime) : false;
  });

  const removed = existing.filter((e) => e.id.startsWith("local-") && !detectedIds.has(e.id));
  const updatedIds = new Set(updated.map((runtime) => runtime.id));
  const unchanged = existing.filter((e) => detectedIds.has(e.id) && !updatedIds.has(e.id));

  return { added, updated, removed, unchanged };
};

export interface RuntimesPageSlice {
  scanDiff: ScanDiff | null;
  scanFailed: boolean;
  isScanning: boolean;

  handleScanButtonClick: (
    existingRuntimes: AgentRuntimeConfig[],
    scanRuntimes: () => Promise<DetectedRuntime[]>,
  ) => Promise<void>;
  handleConfirmSyncButtonClick: (dependencies: {
    createRuntime: (values: AgentRuntimeConfig) => Promise<unknown>;
    updateRuntime: (values: AgentRuntimeConfig) => Promise<unknown>;
    deleteRuntime: (id: string) => Promise<unknown>;
  }) => Promise<void>;
  handleScanDiffModalOpenChange: (open: boolean) => void;
}

export const createRuntimesPageSlice: StateCreator<RuntimesPageSlice> = (set, get) => ({
  scanDiff: null,
  scanFailed: false,
  isScanning: false,

  handleScanButtonClick: async (existingRuntimes, scanRuntimes) => {
    set({ isScanning: true, scanFailed: false });
    const scanResult = await ResultAsync.fromPromise(scanRuntimes(), () => undefined);
    if (scanResult.isErr()) {
      set({ isScanning: false, scanFailed: true });

      return;
    }
    const diff = computeDiff(existingRuntimes, scanResult.value);
    set({ scanDiff: diff, isScanning: false, scanFailed: false });
  },

  handleConfirmSyncButtonClick: async (dependencies) => {
    const diff = get().scanDiff;
    if (!diff) return;
    for (const item of diff.added) {
      await dependencies.createRuntime(item);
    }
    for (const item of diff.updated) {
      await dependencies.updateRuntime(item);
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
