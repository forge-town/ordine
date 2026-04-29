import { useCallback } from "react";
import { Loader2, Plus, Radar, Server, Wifi, WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCustom } from "@refinedev/core";
import { Button } from "@repo/ui/button";
import { Badge } from "@repo/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import { useRuntimesStore, type DetectedRuntime } from "../_store";
import { useStore } from "zustand";

const RuntimeModeIndicator = ({ mode }: { mode: string }) => {
  const isLocal = mode === "local";

  return (
    <Badge
      className={cn("text-[10px]", isLocal ? "" : "bg-blue-500/10 text-blue-600")}
      variant="secondary"
    >
      {isLocal ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {isLocal ? "Local" : "SSH"}
    </Badge>
  );
};

export const RuntimeList = () => {
  const { t } = useTranslation();
  const s = "runtimes";
  const store = useRuntimesStore();
  const runtimes = useStore(store, (state) => state.runtimes);
  const selectedId = useStore(store, (state) => state.selectedId);
  const handleSelect = useStore(store, (state) => state.handleSelectRuntime);
  const handleAdd = useStore(store, (state) => state.handleAddRuntime);
  const handleScanComplete = useStore(store, (state) => state.handleScanComplete);

  const { query: scanQuery } = useCustom<DetectedRuntime[]>({
    method: "get",
    url: "settings/scanRuntimes",
    queryOptions: {
      enabled: false,
    },
  });

  const handleScan = useCallback(async () => {
    const result = await scanQuery.refetch();
    const detected = (result.data?.data as DetectedRuntime[]) ?? [];
    handleScanComplete(detected);
  }, [scanQuery, handleScanComplete]);

  return (
    <div className="flex h-full flex-col overflow-hidden border-r">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
        <h2 className="text-sm font-semibold">{t(`${s}.title`)}</h2>
        <span className="text-xs text-muted-foreground">{runtimes.length}</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {runtimes.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12">
            <Server className="h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">{t(`${s}.empty`)}</p>
          </div>
        ) : (
          <div className="divide-y">
            {runtimes.map((runtime) => (
              <button
                key={runtime.id}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                  runtime.id === selectedId ? "bg-accent" : "hover:bg-accent/50"
                )}
                onClick={() => handleSelect(runtime.id)}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                  <Server className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {runtime.name || t(`${s}.unnamed`)}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{runtime.type}</div>
                </div>
                <RuntimeModeIndicator mode={runtime.connection.mode} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0 space-y-2 border-t p-3">
        <Button
          className="w-full"
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
        <Button className="w-full" size="sm" variant="outline" onClick={handleAdd}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          {t(`${s}.addRuntime`)}
        </Button>
      </div>
    </div>
  );
};
