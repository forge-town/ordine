import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, SquareTerminal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import { useCanvasStore } from "../_store/canvasStore";
import { isTerminalJobStatus } from "./useRunPolling";

const STRUCTURED_PREFIX = "@@";

const stripTimestamp = (message: string): string => message.replace(/^\[[^\]]+\]\s*/, "");

const parseTimestamp = (message: string): string => {
  const match = /^\[([^\]]+)\]/.exec(message);
  if (!match) {
    return "";
  }
  const date = new Date(match[1]);

  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString("en-US", { hour12: false });
};

const lineTone = (message: string): string => {
  if (message.includes("ERROR") || message.startsWith("@@NODE_FAIL")) {
    return "text-destructive";
  }
  if (message.includes("Pipeline complete") || message.startsWith("@@NODE_DONE")) {
    return "text-success";
  }
  if (message.startsWith("@@NODE_START")) {
    return "font-semibold text-foreground/90";
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

  const job = activeJobId ? latestJob : latestJob && !isTerminalJobStatus(latestJob.status) ? latestJob : latestJob;
  const visibleJobId = activeJobId ?? latestJob?.id ?? null;

  useEffect(() => {
    if (scrollRef.current && open) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, runTraces.length]);

  if (!visibleJobId || dismissedJobId === visibleJobId) {
    return null;
  }

  return (
    <div className="pointer-events-auto absolute inset-x-3 bottom-16 z-30" data-testid="canvas-v2-run-console">
      <div className="overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong">
        <div className="flex w-full items-center gap-2 border-b border-border/70 px-3.5 py-2">
          <button
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            data-testid="run-console-toggle"
            type="button"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="flex size-5 items-center justify-center rounded-md bg-surface-2">
              <SquareTerminal className="size-3 text-foreground/75" />
            </span>
            <span className="text-xs font-semibold">{t("workspace.canvas.run.consoleTitle")}</span>
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground">
              {t("workspace.canvas.run.lines", { count: runTraces.length })}
            </span>
            {job ? (
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {visibleJobId} · {job.status}
              </span>
            ) : null}
            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
              {open ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
            </span>
          </button>
          {job && isTerminalJobStatus(job.status) ? (
            <button
              className="rounded-lg px-1.5 py-0.5 text-[10.5px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              data-testid="run-console-dismiss"
              type="button"
              onClick={() => setDismissedJobId(visibleJobId)}
            >
              {t("workspace.canvas.run.dismiss")}
            </button>
          ) : null}
        </div>
        {open ? (
          <div
            className="h-44 overflow-y-auto px-3.5 py-2.5 font-mono text-[10.5px] leading-relaxed"
            ref={scrollRef}
          >
            {runTraces.length === 0 ? (
              <div className="text-muted-foreground/70">{t("workspace.canvas.run.waiting")}</div>
            ) : (
              runTraces.map((trace, index) => {
                const message = stripTimestamp(trace.message);
                const structured = message.startsWith(STRUCTURED_PREFIX);

                return (
                  <div className={cn("flex gap-2", structured && "mt-1.5 first:mt-0")} key={trace.id ?? index}>
                    <span className="shrink-0 tabular-nums text-muted-foreground/60">
                      {parseTimestamp(trace.message)}
                    </span>
                    <span className={cn("break-all", lineTone(message))}>{message}</span>
                  </div>
                );
              })
            )}
            {job?.status === "failed" && job.error ? (
              <div className="mt-2 rounded-lg px-2 py-1.5 status-wash-error">{job.error}</div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
