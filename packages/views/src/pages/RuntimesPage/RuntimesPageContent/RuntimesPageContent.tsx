import { useCreate, useDataProvider, useDelete, useList, useUpdate } from "@refinedev/core";
import { useStore } from "zustand";
import { CircleAlert, Cpu, Loader2, Radar, RefreshCw, TerminalSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Skeleton } from "@repo/ui/skeleton";
import { PageHeader } from "../../../components/PageHeader";
import { PageState } from "../../../components/PageState";
import { LocalAgentCard } from "../LocalAgentCard";
import { ScanDiffModal } from "../ScanDiffModal";
import { type DetectedRuntime, useRuntimesPageStore } from "../_store";

const SUPPORTED_RUNTIME_COUNT = 5;

export const RuntimesPageContent = () => {
  const { t } = useTranslation();
  const store = useRuntimesPageStore();
  const isScanning = useStore(store, (s) => s.isScanning);
  const scanFailed = useStore(store, (s) => s.scanFailed);
  const handleScanButtonClick = useStore(store, (s) => s.handleScanButtonClick);
  const handleConfirmSyncButtonClick = useStore(store, (s) => s.handleConfirmSyncButtonClick);
  const getDataProvider = useDataProvider();
  const { mutateAsync: createRuntime } = useCreate();
  const { mutateAsync: updateRuntime } = useUpdate();
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
      updateRuntime: (values) =>
        updateRuntime({
          resource: "agentRuntimes",
          id: values.id,
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
        <div className="mb-3 rounded-lg border border-border/80 bg-surface px-3.5 py-3">
          <div className="flex items-start gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-surface-2 ring-1 ring-border">
              <TerminalSquare className="size-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground">
                {t("localAgents.howItWorks")}
              </div>
              <ol className="mt-1.5 grid gap-1 text-[11.5px] leading-5 text-muted-foreground lg:grid-cols-3 lg:gap-4">
                <li>{t("localAgents.stepScan")}</li>
                <li>{t("localAgents.stepSync")}</li>
                <li>{t("localAgents.stepRun")}</li>
              </ol>
            </div>
          </div>
        </div>

        {scanFailed && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3.5 py-2.5 text-[11.5px] text-destructive">
            <CircleAlert className="size-3.5 shrink-0" />
            <span>{t("localAgents.scanFailed")}</span>
          </div>
        )}

        {runtimesQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-[190px] w-full rounded-lg" />
            ))}
          </div>
        ) : runtimesQuery.isError ? (
          <PageState
            action={
              <Button size="sm" variant="outline" onClick={() => runtimesQuery.refetch()}>
                <RefreshCw className="size-3.5" />
                {t("common.retry")}
              </Button>
            }
            description={t("errors.networkError")}
            icon={<Radar />}
            title={t("common.notFound")}
          />
        ) : runtimes.length === 0 ? (
          <PageState
            description={t("localAgents.emptyHint")}
            icon={<Cpu />}
            title={t("localAgents.empty")}
          />
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
