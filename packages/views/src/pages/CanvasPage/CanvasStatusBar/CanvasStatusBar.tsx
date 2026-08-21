import { CircleDashed } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import type { NodeRunStatus } from "@repo/schemas";
import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui/popover";
import { useCanvasPageStore, selectSelectedNode } from "../_store";
import { formatZoomPercent } from "../utils/canvasViewport";

type LegendTone = "err" | "fg" | "neutral" | "ok" | "warn";

const STATE_DEFS: ReadonlyArray<readonly [NodeRunStatus, LegendTone]> = [
  ["idle", "neutral"],
  ["queued", "neutral"],
  ["running", "fg"],
  ["retrying", "warn"],
  ["waitingForUser", "warn"],
  ["done", "ok"],
  ["failed", "err"],
  ["skipped", "neutral"],
  ["cancelled", "neutral"],
];

const STATE_LABELS: Record<NodeRunStatus, string> = {
  cancelled: "Cancelled",
  done: "Done",
  failed: "Failed",
  idle: "Idle",
  queued: "Queued",
  retrying: "Retrying",
  running: "Running",
  skipped: "Skipped",
  waitingForUser: "Waiting for user",
};

const TONE_CLASS: Record<Exclude<LegendTone, "neutral">, string> = {
  err: "bg-destructive",
  fg: "bg-foreground",
  ok: "bg-success",
  warn: "bg-warning",
};

export const CanvasStatusBar = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const viewportZoom = useStore(store, (state) => state.viewportZoom);
  const selectedNode = useStore(store, selectSelectedNode);
  const getStateLabel = (status: NodeRunStatus) => {
    const stateKey = `workspace.canvas.chrome.states.${status}`;
    const translatedLabel = t(stateKey, { defaultValue: STATE_LABELS[status] });

    return translatedLabel === stateKey ? STATE_LABELS[status] : translatedLabel;
  };

  return (
    <Popover>
      <PopoverTrigger
        className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs text-foreground shadow-soft ring-1 ring-border transition-colors hover:ring-border-strong data-[popup-open]:bg-foreground data-[popup-open]:text-background max-[480px]:px-2"
        data-testid="canvas-v2-state-legend-trigger"
      >
        <CircleDashed className="size-3.5" />
        <span className="max-[480px]:sr-only">
          {t("workspace.canvas.chrome.states.trigger", { defaultValue: "States" })}
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 rounded-2xl p-2.5" sideOffset={8}>
        <div
          className="px-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
          data-testid="canvas-v2-state-legend"
        >
          {t("workspace.canvas.chrome.states.title", { defaultValue: "Node run states" })}
        </div>
        <div className="space-y-0.5">
          {STATE_DEFS.map(([status, tone]) => (
            <div key={status} className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-xs">
              <span className="relative inline-flex size-2 items-center justify-center">
                {tone === "neutral" ? (
                  <span className="size-2 rounded-full bg-surface shadow-[inset_0_0_0_1.5px_var(--color-muted-foreground)]" />
                ) : (
                  <span className={`size-2 rounded-full ${TONE_CLASS[tone]}`} />
                )}
              </span>
              <span className="flex-1">{getStateLabel(status)}</span>
              <span className="font-mono text-[9px] text-muted-foreground/70">{status}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 border-t border-border px-1 pt-2" data-testid="canvas-status-bar">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-muted-foreground">
            <span className="whitespace-nowrap">
              {t("canvas.status.nodeCount", { count: nodes.length })}
            </span>
            <span className="text-border">|</span>
            <span className="whitespace-nowrap">
              {t("canvas.status.edgeCount", { count: edges.length })}
            </span>
            <span className="text-border">|</span>
            <span className="whitespace-nowrap">
              {t("canvas.status.zoom", { zoom: formatZoomPercent(viewportZoom) })}
            </span>
            <span className="text-border">|</span>
            <span className="max-w-56 truncate">
              {selectedNode
                ? t("canvas.status.selectedNode", { label: selectedNode.data.label })
                : t("canvas.status.noSelection")}
            </span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
