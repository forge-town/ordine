import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, SquareTerminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TRACE_MARKER_PREFIX } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";
import { useCanvasStore } from "../_store/canvasStore";
import { isTerminalJobStatus } from "./useRunPolling";

const stripTimestamp = (message: string): string => message.replace(/^\[[^\]]+\]\s*/, "");

const parseTimestamp = (message: string): string => {
  const match = /^\[([^\]]+)\]/.exec(message);
  if (!match) {
    return "";
  }
  const date = new Date(match[1]);

  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("en-US", { hour12: false });
};

const lineTone = (message: string): string => {
  if (message.includes("ERROR")) {
    return "text-destructive";
  }
  if (message.includes("Pipeline complete")) {
    return "text-success";
  }

  return "text-muted-foreground";
};

export const RunConsole = () => {
  const { t } = useTranslation();
  const activeJobId = useCanvasStore((state) => state.activeJobId);
  const latestJob = useCanvasStore((state) => state.latestJob);
  const runTraces = useCanvasStore((state) => state.runTraces);
  const [open, setOpen] = useState(true);
  const [dismissedJobId, setDismissedJobId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const visibleJobId = activeJobId ?? latestJob?.id ?? null;
  const handleToggle = () => setOpen((value) => !value);
  const handleDismiss = () => setDismissedJobId(visibleJobId);
  const visibleTraces = runTraces.filter(
    (trace) => !stripTimestamp(trace.message).startsWith(TRACE_MARKER_PREFIX),
  );

  useEffect(() => {
    if (scrollRef.current && open) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, runTraces.length]);

  if (!visibleJobId || dismissedJobId === visibleJobId) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto absolute inset-x-3 bottom-16 z-30"
      data-testid="canvas-v2-run-console"
    >
      <div className="overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong">
        <div className="flex w-full items-center gap-2 border-b border-border/70 px-3.5 py-2">
          <button
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            data-testid="run-console-toggle"
            type="button"
            onClick={handleToggle}
          >
            <span className="flex size-5 items-center justify-center rounded-md bg-surface-2">
              <SquareTerminal className="size-3 text-foreground/75" />
            </span>
            <span className="text-xs font-semibold">{t("workspace.canvas.run.consoleTitle")}</span>
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground">
              {t("workspace.canvas.run.lines", { count: visibleTraces.length })}
            </span>
            <span className="truncate font-mono text-[10px] text-muted-foreground">
              {visibleJobId} · {latestJob?.status ?? "running"}
            </span>
            <span className="ml-auto text-muted-foreground">
              {open ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
            </span>
          </button>
          {latestJob && isTerminalJobStatus(latestJob.status) ? (
            <button
              className="rounded-lg px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              data-testid="run-console-dismiss"
              type="button"
              onClick={handleDismiss}
            >
              {t("workspace.canvas.run.dismiss")}
            </button>
          ) : null}
        </div>
        {open ? (
          <div
            ref={scrollRef}
            className="h-44 overflow-y-auto px-3.5 py-2.5 font-mono text-[10.5px] leading-relaxed"
          >
            {visibleTraces.length === 0 ? (
              <div className="text-muted-foreground/70">{t("workspace.canvas.run.waiting")}</div>
            ) : (
              visibleTraces.map((trace, index) => {
                const message = stripTimestamp(trace.message);

                return (
                  <div key={trace.id ?? index} className="flex gap-2">
                    <span className="shrink-0 tabular-nums text-muted-foreground/60">
                      {parseTimestamp(trace.message)}
                    </span>
                    <span className={cn("break-all", lineTone(message))}>{message}</span>
                  </div>
                );
              })
            )}
            {latestJob?.status === "failed" && latestJob.error ? (
              <div className="mt-2 rounded-lg px-2 py-1.5 status-wash-error">{latestJob.error}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
