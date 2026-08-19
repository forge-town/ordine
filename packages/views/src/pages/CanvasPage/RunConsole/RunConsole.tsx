import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Terminal, X, ChevronUp, ChevronDown, Loader2, FileText } from "lucide-react";
import { Button } from "@repo/ui/button";
import { ScrollArea } from "@repo/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";
import { useCustom, useDataProvider, useOne } from "@refinedev/core";
import { useStore } from "zustand";
import { useCanvasPageStore } from "../_store";
import { StatusIcon } from "./StatusIcon";
import {
  buildRunTimeline,
  summarizeMultiInputNodes,
  type RunTimelineStatus,
} from "./runTraceParser";
import { ResourceName } from "../../../constants";
import type { Job, JobStatus } from "@repo/schemas";

const POLL_INTERVAL = 1500;

type RunTrace = {
  createdAt?: Date | string;
  id?: number;
  message: string;
};

const statusLabelKeys: Record<JobStatus, string> = {
  queued: "canvas.runConsole.statusQueued",
  running: "canvas.runConsole.statusRunning",
  paused: "canvas.runConsole.statusPaused",
  done: "canvas.runConsole.statusDone",
  failed: "canvas.runConsole.statusFailed",
  cancelled: "canvas.runConsole.statusCancelled",
  expired: "canvas.runConsole.statusExpired",
  skipped: "canvas.runConsole.statusSkipped",
};

const parseTimestamp = (log: string): string => {
  const match = /^\[([^\]]+)\]/.exec(log);
  if (!match) return "";
  const d = new Date(match[1]);
  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleTimeString("en-US", {
    hour12: false,
    fractionalSecondDigits: 3,
  });
};

const parseMessage = (log: string): string => {
  const match = /^\[([^\]]+)\]\s*/.exec(log);
  if (!match || Number.isNaN(new Date(match[1]).getTime())) return log;

  return log.slice(match[0].length);
};

const STRUCTURED_LOG_PREFIX = "@@";

const parseStructuredLogs = (
  logs: string[],
  callbacks: {
    onNodeStart: (nodeId: string) => void;
    onNodeDone: (nodeId: string) => void;
    onNodeFail: (nodeId: string) => void;
    onLlmContent: (nodeId: string, content: string) => void;
  },
) => {
  for (const log of logs) {
    const msg = log.replace(/^\[[^\]]+\]\s*/, "");
    if (!msg.startsWith(STRUCTURED_LOG_PREFIX)) continue;
    if (msg.startsWith("@@NODE_START::")) {
      callbacks.onNodeStart(msg.slice("@@NODE_START::".length));
    } else if (msg.startsWith("@@NODE_DONE::")) {
      callbacks.onNodeDone(msg.slice("@@NODE_DONE::".length));
    } else if (msg.startsWith("@@NODE_FAIL::")) {
      callbacks.onNodeFail(msg.slice("@@NODE_FAIL::".length));
    } else if (msg.startsWith("@@LLM_CONTENT::")) {
      const rest = msg.slice("@@LLM_CONTENT::".length);
      const sepIdx = rest.indexOf("::");
      if (sepIdx !== -1) {
        callbacks.onLlmContent(rest.slice(0, sepIdx), rest.slice(sepIdx + 2));
      }
    }
  }
};

const isStructuredLog = (log: string): boolean => {
  const msg = log.replace(/^\[[^\]]+\]\s*/, "");

  return msg.startsWith(STRUCTURED_LOG_PREFIX);
};

const isTerminalStatus = (s: JobStatus) =>
  s === "done" || s === "failed" || s === "cancelled" || s === "expired" || s === "skipped";

const timelineStatusLabelKeys: Record<RunTimelineStatus, string> = {
  running: "canvas.runConsole.nodeStatusRunning",
  done: "canvas.runConsole.nodeStatusDone",
  failed: "canvas.runConsole.nodeStatusFailed",
};

export const RunConsole = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const jobId = useStore(store, (s) => s.activeJobId);
  const nodes = useStore(store, (s) => s.nodes);
  const edges = useStore(store, (s) => s.edges);
  const handleCloseConsole = useStore(store, (s) => s.handleCloseConsole);
  const markNodeRunning = useStore(store, (s) => s.markNodeRunning);
  const markNodePassed = useStore(store, (s) => s.markNodePassed);
  const markNodeFailed = useStore(store, (s) => s.markNodeFailed);
  const applyNodeLlmContent = useStore(store, (s) => s.applyNodeLlmContent);
  const setNodeRunStatuses = useStore(store, (s) => s.setNodeRunStatuses);
  const stopTestRun = useStore(store, (s) => s.stopTestRun);
  const isConsoleCollapsed = useStore(store, (s) => s.isConsoleCollapsed);
  const handleToggleConsoleCollapse = useStore(store, (s) => s.handleToggleConsoleCollapse);
  const getDataProvider = useDataProvider();
  const dataProvider = getDataProvider();

  const scrollRef = useRef<HTMLDivElement>(null);
  const processedTraceRef = useRef({ jobId: null as string | null, count: 0 });
  const isConsoleCollapsedRef = useRef(isConsoleCollapsed);
  isConsoleCollapsedRef.current = isConsoleCollapsed;

  const applyStructuredTraceLogs = useCallback(
    (currentJobId: string, logs: string[]) => {
      if (processedTraceRef.current.jobId !== currentJobId) {
        processedTraceRef.current = { jobId: currentJobId, count: 0 };
      }

      if (logs.length <= processedTraceRef.current.count) return;

      const newLogs = logs.slice(processedTraceRef.current.count);
      processedTraceRef.current.count = logs.length;

      parseStructuredLogs(newLogs, {
        onNodeStart: markNodeRunning,
        onNodeDone: markNodePassed,
        onNodeFail: markNodeFailed,
        onLlmContent: applyNodeLlmContent,
      });

      requestAnimationFrame(() => {
        if (scrollRef.current && !isConsoleCollapsedRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    },
    [markNodeRunning, markNodePassed, markNodeFailed, applyNodeLlmContent],
  );

  const { query: jobQuery } = useOne<Job>({
    resource: ResourceName.jobs,
    id: jobId ?? "",
    queryOptions: {
      enabled: !!jobId,
      queryFn: async () => {
        const currentJobId = jobId ?? "";
        const response = await dataProvider.getOne!<Job>({
          resource: ResourceName.jobs,
          id: currentJobId,
        });

        if (isTerminalStatus(response.data.status)) {
          stopTestRun();
        }

        return response;
      },
      refetchInterval: (query) => {
        const status = (query.state.data?.data as Job | undefined)?.status;
        if (status && isTerminalStatus(status)) return false;

        return POLL_INTERVAL;
      },
    },
  });

  const job = (jobQuery.data?.data as Job | undefined) ?? null;
  const jobRef = useRef(job);
  jobRef.current = job;

  useEffect(() => {
    if (!job?.nodeStatuses) {
      return;
    }

    setNodeRunStatuses(job.nodeStatuses);
  }, [job, setNodeRunStatuses]);

  const { result: tracesResult } = useCustom<{ traces: RunTrace[] }>({
    url: "jobs/traces",
    method: "get",
    config: { payload: { jobId: jobId ?? "" } },
    queryOptions: {
      enabled: !!jobId,
      queryFn: async () => {
        const currentJobId = jobId ?? "";
        const response = await dataProvider.custom!<{ traces: RunTrace[] }>({
          url: "jobs/traces",
          method: "get",
          payload: { jobId: currentJobId },
        });
        const logs = response.data.traces.map((trace) => trace.message);
        applyStructuredTraceLogs(currentJobId, logs);

        return response;
      },
      refetchInterval: () => {
        if (jobRef.current && isTerminalStatus(jobRef.current.status)) return false;

        return POLL_INTERVAL;
      },
    },
  });
  const traces = tracesResult.data?.traces ?? [];
  const traceLogs = traces.map((trace) => trace.message);
  const runTimeline = buildRunTimeline(traces);
  const multiInputSummary = summarizeMultiInputNodes(edges);
  const nodeLabelById = new Map(
    nodes.map((node) => [node.id, node.data.label ?? node.id] as const),
  );
  const currentNodeLabel =
    runTimeline.currentNodeId === null
      ? t("canvas.runConsole.currentStepIdle")
      : (nodeLabelById.get(runTimeline.currentNodeId) ?? runTimeline.currentNodeId);

  return (
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 z-30 border-t bg-surface shadow-float transition-all",
        isConsoleCollapsed ? "h-9" : "h-64",
      )}
      data-testid="canvas-run-console"
    >
      {/* Status bar */}
      <div className="flex h-9 items-center justify-between border-b bg-surface-2/80 px-3">
        <div className="flex items-center gap-2 text-xs">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">{t("canvas.runConsole.title")}</span>
          {job && (
            <>
              <span className="text-muted-foreground">|</span>
              <StatusIcon status={job.status} />
              <span
                className={cn(
                  "font-medium",
                  job.status === "running" && "text-blue-600 dark:text-blue-400",
                  job.status === "done" && "text-emerald-600 dark:text-emerald-400",
                  job.status === "failed" && "text-red-600 dark:text-red-400",
                  job.status === "expired" && "text-muted-foreground",
                )}
              >
                {t(statusLabelKeys[job.status])}
              </span>
              {job.status === "running" && (
                <span className="text-muted-foreground">
                  ({t("canvas.runConsole.logs", { count: traceLogs.length })})
                </span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <Button
            className="h-6 w-6"
            size="icon"
            variant="ghost"
            onClick={handleToggleConsoleCollapse}
          >
            {isConsoleCollapsed ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button className="h-6 w-6" size="icon" variant="ghost" onClick={handleCloseConsole}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Log area */}
      {!isConsoleCollapsed && (
        <ScrollArea className="h-[calc(100%-2.25rem)]">
          <div ref={scrollRef} className="h-full overflow-auto p-3 text-xs">
            {!job && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("canvas.runConsole.loading")}
              </div>
            )}
            {job && (
              <div className="mb-3 grid gap-2 lg:grid-cols-[1fr_1.15fr]">
                <section className="rounded-lg border bg-card/70 p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("canvas.runConsole.currentStep")}
                  </div>
                  <div className="mt-1 truncate text-sm font-semibold">{currentNodeLabel}</div>
                  {runTimeline.latestProgressMessage && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {runTimeline.latestProgressMessage}
                    </p>
                  )}
                  <p className="mt-2 rounded-md bg-blue-500/10 px-2 py-1 text-[11px] text-blue-700 dark:text-blue-300">
                    {multiInputSummary.count > 0
                      ? t("canvas.runConsole.multiInputRuleWithCount", {
                          count: multiInputSummary.count,
                        })
                      : t("canvas.runConsole.multiInputRule")}
                  </p>
                </section>

                <section className="rounded-lg border bg-card/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("canvas.runConsole.timeline")}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {t("canvas.runConsole.timelineCount", {
                        count: runTimeline.timeline.length,
                      })}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {runTimeline.timeline.length === 0 ? (
                      <span className="text-muted-foreground">
                        {t("canvas.runConsole.timelineEmpty")}
                      </span>
                    ) : (
                      runTimeline.timeline.map((item) => (
                        <span
                          key={item.nodeId}
                          className={cn(
                            "inline-flex max-w-[220px] items-center gap-1 rounded-full border px-2 py-1",
                            item.status === "running" &&
                              "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300",
                            item.status === "done" &&
                              "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                            item.status === "failed" &&
                              "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
                          )}
                        >
                          <span className="truncate">
                            {nodeLabelById.get(item.nodeId) ?? item.nodeId}
                          </span>
                          <span className="shrink-0 text-[10px] font-semibold uppercase">
                            {t(timelineStatusLabelKeys[item.status])}
                          </span>
                        </span>
                      ))
                    )}
                  </div>
                </section>

                {runTimeline.artifacts.length > 0 && (
                  <section className="rounded-lg border bg-card/70 p-3 lg:col-span-2">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      {t("canvas.runConsole.artifacts")}
                    </div>
                    <div className="flex flex-col gap-1">
                      {runTimeline.artifacts.map((artifact) => (
                        <code
                          key={artifact.path}
                          className="rounded bg-muted px-2 py-1 font-mono text-[11px] text-foreground"
                        >
                          {artifact.path}
                        </code>
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}
            {traceLogs
              .filter((l) => !isStructuredLog(l))
              .map((log, i) => (
                <div key={i} className="flex gap-2 py-0.5 font-mono hover:bg-muted/30">
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {parseTimestamp(log)}
                  </span>
                  <span
                    className={cn(
                      "break-all",
                      log.includes("ERROR") && "font-medium text-red-600 dark:text-red-400",
                      log.includes("Pipeline complete") &&
                        "font-medium text-emerald-600 dark:text-emerald-400",
                      log.includes("Cloned to") && "text-blue-600 dark:text-blue-400",
                      log.includes("Skill output") && "text-violet-600 dark:text-violet-400",
                    )}
                  >
                    {parseMessage(log)}
                  </span>
                </div>
              ))}
            {job?.status === "failed" && job.error && (
              <div className="mt-2 rounded border border-red-500/20 bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-300">
                {job.error}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
