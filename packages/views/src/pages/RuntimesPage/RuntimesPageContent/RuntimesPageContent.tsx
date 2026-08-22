import { useCustom, useCustomMutation } from "@refinedev/core";
import { CircleAlert, Cpu, Loader2, Radar, RefreshCw, TerminalSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { AgentRuntimeCatalogEntry } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Skeleton } from "@repo/ui/skeleton";
import { PageHeader } from "../../../components/PageHeader";
import { PageState } from "../../../components/PageState";
import { LocalAgentCard } from "../LocalAgentCard";
import { RuntimeConnectionTestSheet } from "../RuntimeConnectionTestSheet";
import { useRuntimesPageStore } from "../_store";

export const RuntimesPageContent = () => {
  const { t } = useTranslation();
  const store = useRuntimesPageStore();
  const connectionTestRuntimeConfigId = useStore(
    store,
    (state) => state.connectionTestRuntimeConfigId,
  );
  const isScanning = useStore(store, (state) => state.isScanning);
  const scanFailed = useStore(store, (state) => state.scanFailed);
  const handleConnectionTestOpenChange = useStore(
    store,
    (state) => state.handleConnectionTestOpenChange,
  );
  const handleRescanButtonClick = useStore(store, (state) => state.handleRescanButtonClick);
  const { result, query: catalogQuery } = useCustom<AgentRuntimeCatalogEntry[]>({
    method: "get",
    url: "agentRuntimes/getCatalog",
  });
  const { mutateAsync: rescanCatalog } = useCustomMutation();
  const catalog = result?.data ?? [];
  const orderedCatalog = [...catalog].sort((left, right) => {
    const supportOrder = { supported: 0, experimental: 1, unsupported: 2 } as const;

    return (
      supportOrder[left.compatibility.supportLevel] - supportOrder[right.compatibility.supportLevel]
    );
  });
  const supported = catalog.filter((entry) => entry.compatibility.supportLevel === "supported");
  const launchable = supported.filter((entry) => entry.availability === "launchable");
  const connectionTestEntry = catalog.find(
    (entry) => entry.runtimeConfigId === connectionTestRuntimeConfigId,
  );

  const handleScan = () => {
    void handleRescanButtonClick(async () => {
      const response = await rescanCatalog({
        method: "post",
        url: "agentRuntimes/rescanCatalog",
        values: {},
      });
      await catalogQuery.refetch();

      return response.data as AgentRuntimeCatalogEntry[];
    });
  };
  const handleCatalogRetry = () => {
    void catalogQuery.refetch();
  };
  const handleConnectionSheetOpenChange = (open: boolean) => {
    if (!open) handleConnectionTestOpenChange(null);
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
        badge={
          <span className="text-xs text-muted-foreground">
            {launchable.length}/{supported.length}
          </span>
        }
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

        {catalogQuery.isLoading ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-[230px] w-full rounded-lg" />
            ))}
          </div>
        ) : catalogQuery.isError ? (
          <PageState
            action={
              <Button size="sm" variant="outline" onClick={handleCatalogRetry}>
                <RefreshCw className="size-3.5" />
                {t("common.retry")}
              </Button>
            }
            description={t("errors.networkError")}
            icon={<Radar />}
            title={t("common.notFound")}
          />
        ) : catalog.length === 0 ? (
          <PageState
            description={t("localAgents.emptyHint")}
            icon={<Cpu />}
            title={t("localAgents.empty")}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            {orderedCatalog.map((entry) => (
              <LocalAgentCard
                key={entry.runtime}
                entry={entry}
                onConnectionTest={handleConnectionTestOpenChange}
              />
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-2 px-3.5 py-2.5 text-[11.5px] text-muted-foreground">
          <Radar className="size-3.5 shrink-0" />
          <span>
            {t("localAgents.detected", {
              count: launchable.length,
              total: supported.length,
            })}
          </span>
        </div>
      </div>

      <RuntimeConnectionTestSheet
        entry={connectionTestEntry ?? null}
        open={connectionTestEntry !== undefined}
        onOpenChange={handleConnectionSheetOpenChange}
      />
    </div>
  );
};
