import { useCreate, useDataProvider, useDelete, useList } from "@refinedev/core";
import { useStore } from "zustand";
import { Loader2, Radar, Server } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Skeleton } from "@repo/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { RuntimesDataTable } from "../RuntimesDataTable";
import { ScanDiffModal } from "../ScanDiffModal";
import { type DetectedRuntime, useRuntimesPageStore } from "../_store";

const s = "runtimes";

export const RuntimesPageContent = () => {
  const { t } = useTranslation();
  const store = useRuntimesPageStore();
  const isScanning = useStore(store, (s) => s.isScanning);
  const handleScanButtonClick = useStore(store, (s) => s.handleScanButtonClick);
  const handleConfirmSyncButtonClick = useStore(store, (s) => s.handleConfirmSyncButtonClick);
  const getDataProvider = useDataProvider();
  const { mutateAsync: createRuntime } = useCreate();
  const { mutateAsync: deleteRuntime } = useDelete();

  const { result: runtimesResult, query: runtimesQuery } = useList<AgentRuntimeConfig>({
    resource: "agentRuntimes",
  });
  const runtimes = runtimesResult.data;

  const handleScan = () => {
    const dataProvider = getDataProvider();
    void handleScanButtonClick(runtimes, async () => {
      const result = await dataProvider.custom!<DetectedRuntime[]>({
        method: "get",
        url: "settings/scanRuntimes",
      });

      return result.data;
    });
  };

  const handleConfirmSync = async () => {
    await handleConfirmSyncButtonClick({
      createRuntime: (values) =>
        createRuntime({
          resource: "agentRuntimes",
          values,
        }),
      deleteRuntime: (id) =>
        deleteRuntime({
          resource: "agentRuntimes",
          id,
        }),
    });
    await runtimesQuery.refetch();
  };

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

      <ScanDiffModal onConfirm={handleConfirmSync} />
    </div>
  );
};
