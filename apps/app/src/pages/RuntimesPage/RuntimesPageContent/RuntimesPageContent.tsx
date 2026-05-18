import { useCallback } from "react";
import { useList, useCustom, useCreate, useDelete } from "@refinedev/core";
import { useStore } from "zustand";
import { Loader2, Radar, Server } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Skeleton } from "@repo/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { RuntimesDataTable } from "../RuntimesDataTable";
import { ScanDiffModal } from "../ScanDiffModal";
import { useRuntimesPageStore, type ScanDiff } from "../_store";

const s = "runtimes";

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

export const RuntimesPageContent = () => {
  const { t } = useTranslation();
  const store = useRuntimesPageStore();
  const isScanning = useStore(store, (s) => s.isScanning);
  const setScanDiff = useStore(store, (s) => s.setScanDiff);
  const setIsScanning = useStore(store, (s) => s.setIsScanning);
  const scanDiff = useStore(store, (s) => s.scanDiff);
  const closeScanModal = useStore(store, (s) => s.closeScanModal);

  const { result: runtimesResult, query: runtimesQuery } = useList<AgentRuntimeConfig>({
    resource: "agentRuntimes",
  });

  const { query: scanQuery } = useCustom<DetectedRuntime[]>({
    method: "get",
    url: "settings/scanRuntimes",
    queryOptions: { enabled: false },
  });

  const { mutateAsync: createRuntime } = useCreate();
  const { mutateAsync: deleteRuntime } = useDelete();

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    const result = await scanQuery.refetch();
    const detected = (result.data?.data ?? []) as DetectedRuntime[];
    const diff = computeDiff(runtimesResult.data, detected);
    setScanDiff(diff);
    setIsScanning(false);
  }, [scanQuery, runtimesResult.data, setScanDiff, setIsScanning]);

  const handleConfirm = useCallback(async () => {
    if (!scanDiff) return;
    for (const item of scanDiff.added) {
      await createRuntime({ resource: "agentRuntimes", values: item });
    }
    for (const item of scanDiff.removed) {
      await deleteRuntime({ resource: "agentRuntimes", id: item.id });
    }
    closeScanModal();
    await runtimesQuery.refetch();
  }, [scanDiff, createRuntime, deleteRuntime, runtimesQuery, closeScanModal]);

  const runtimes = runtimesResult.data;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <Button disabled={isScanning} size="sm" variant="outline" onClick={handleScan}>
            {isScanning ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Radar className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t(`${s}.scan`)}
          </Button>
        }
        badge={
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {runtimes.length}
          </span>
        }
        icon={<Server className="h-4 w-4 text-primary" />}
        title={t(`${s}.title`)}
      />

      <div className="flex-1 overflow-auto p-6">
        {runtimesQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : runtimes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Server className="h-10 w-10 text-muted-foreground/30" />
            <p className="mt-3 text-sm text-muted-foreground">{t(`${s}.empty`)}</p>
          </div>
        ) : (
          <RuntimesDataTable data={runtimes} />
        )}
      </div>

      <ScanDiffModal onConfirm={handleConfirm} />
    </div>
  );
};
