import { useCreate, useDataProvider, useDelete, useList } from "@refinedev/core";
import { useStore } from "zustand";
import { Cpu, Loader2, Radar, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Skeleton } from "@repo/ui/skeleton";
import { PageHeader } from "../../../components/PageHeader";
import { LocalAgentCard } from "../LocalAgentCard";
import { ScanDiffModal } from "../ScanDiffModal";
import { type DetectedRuntime, useRuntimesPageStore } from "../_store";

const SUPPORTED_RUNTIME_COUNT = 5;

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
  const localRuntimes = runtimes.filter((runtime) => runtime.connection.mode === "local");

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
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
            {isScanning ? t("localAgents.scanning") : t("localAgents.rescan")}
          </Button>
        }
        badge={<span className="text-xs text-muted-foreground">{runtimes.length}</span>}
        eyebrow={t("nav.groups.capabilities")}
        icon={<Cpu className="size-[18px] text-muted-foreground" />}
        sub={t("localAgents.subtitle")}
        title={t("localAgents.title")}
      />

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        {runtimesQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[190px] w-full rounded-lg" />
            ))}
          </div>
        ) : runtimes.length === 0 ? (
          <div className="grid place-items-center rounded-lg bg-surface-2/50 py-16 text-center text-muted-foreground">
            <Cpu className="size-8 text-muted-foreground/30" />
            <p className="mt-2 text-[13px] font-medium text-foreground">{t("localAgents.empty")}</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              {t("localAgents.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {runtimes.map((runtime) => (
              <LocalAgentCard key={runtime.id} runtime={runtime} />
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3.5 py-2.5 text-[11.5px] text-muted-foreground">
          <Radar className="size-3.5 shrink-0" />
          <span>
            {t("localAgents.detected", {
              count: localRuntimes.length,
              total: SUPPORTED_RUNTIME_COUNT,
            })}
          </span>
        </div>
      </div>

      <ScanDiffModal onConfirm={handleConfirmSync} />
    </div>
  );
};
