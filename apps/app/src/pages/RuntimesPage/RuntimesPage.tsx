import { useCallback } from "react";
import { useList, useCustom } from "@refinedev/core";
import { Loader2, Plus, Radar, Server } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AgentRuntimeConfig } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { Skeleton } from "@repo/ui/skeleton";
import { PageHeader } from "@/components/PageHeader";
import { RuntimesDataTable } from "./RuntimesDataTable";

const s = "runtimes";

interface DetectedRuntime {
  type: string;
  binaryName: string;
  path: string;
  version?: string;
}

export const RuntimesPage = () => {
  const { t } = useTranslation();
  const { result: runtimesResult, query: runtimesQuery } = useList<AgentRuntimeConfig>({
    resource: "agentRuntimes",
  });

  const { query: scanQuery } = useCustom<DetectedRuntime[]>({
    method: "get",
    url: "settings/scanRuntimes",
    queryOptions: {
      enabled: false,
    },
  });

  const handleScan = useCallback(async () => {
    await scanQuery.refetch();
  }, [scanQuery]);

  const runtimes = runtimesResult.data;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        actions={
          <div className="flex items-center gap-2">
            <Button
              disabled={scanQuery.isFetching}
              size="sm"
              variant="outline"
              onClick={handleScan}
            >
              {scanQuery.isFetching ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Radar className="mr-1.5 h-3.5 w-3.5" />
              )}
              {t(`${s}.scan`)}
            </Button>
            <Button size="sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {t(`${s}.addRuntime`)}
            </Button>
          </div>
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
    </div>
  );
};
