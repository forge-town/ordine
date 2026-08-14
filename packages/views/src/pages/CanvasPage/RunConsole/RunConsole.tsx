import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  FileText,
  ListTree,
  Loader2,
  RotateCcw,
  Square,
  Terminal,
  X,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { ScrollArea } from "@repo/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";
import { useCustom, useDataProvider, useOne } from "@refinedev/core";
import { useStore } from "zustand";
import { useCanvasPageStore } from "../_store";
import { StatusIcon } from "./StatusIcon";
import { buildRunTimeline, type RunTimelineStatus } from "./runTraceParser";
import { ResourceName } from "../../../constants";
import type { Job, JobStatus } from "@repo/schemas";

const POLL_INTERVAL = 1500;
const WAITING_THRESHOLD_SECONDS = 20;
const SLOW_THRESHOLD_SECONDS = 120;

type RunTrace = {
  createdAt?: Date | string;
  id?: number;
  message: string;
};

type VisualStepStatus = RunTimelineStatus | "pending";

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

const timelineStatusLabelKeys: Record<VisualStepStatus, string> = {
  pending: "canvas.runConsole.nodeStatusPending",
  running: "canvas.runConsole.nodeStatusRunning",
  done: "canvas.runConsole.nodeStatusDone",
  failed: "canvas.runConsole.nodeStatusFailed",
};

const parseTimestamp = (log: string): string => {
  const match = /^\[([^\]]+)\]/.exec(log);
  if (!match) return "";
  const date = new Date(match[1]);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("en-US", {
    hour12: false,
    fractionalSecondDigits: 3,
  });
};

const parseMessage = (log: string): string => {
  const match = /^\[([^\]]+)\]\s*/.exec(log);
  if (!match || Number.isNaN(new Date(match[1]).getTime())) return log;

  return log.slice(match[0].length);
};

const parseTraceTime = (trace: RunTrace): number | null => {
  if (trace.createdAt) {
    const createdAt = new Date(trace.createdAt).getTime();
    if (!Number.isNaN(createdAt)) return createdAt;
  }

  const match = /^\[([^\]]+)\]/.exec(trace.message);
  if (!match) return null;
  const embedded = new Date(match[1]).getTime();

  return Number.isNaN(embedded) ? null : embedded;
};

const parseAgentName = (logs: string[]): string | null => {
  for (const log of [...logs].reverse()) {
    const match = /\[LLM\]\s+runPrompt:\s+agent=([^,\s]+)/i.exec(log);
    if (match) return match[1];
    if (log.includes("[Codex] Starting codex exec")) return "Codex";
  }

  return null;
};

type AgentProgress = {
  labelKey:
    | "canvas.runConsole.phasePlanning"
    | "canvas.runConsole.phaseInspecting"
    | "canvas.runConsole.phaseTool"
    | "canvas.runConsole.phaseExternal"
    | "canvas.runConsole.phasePreparing"
    | "canvas.runConsole.phaseReviewing"
    | "canvas.runConsole.phaseFinalizing";
  action?: number;
};

const parseAgentProgress = (logs: string[]): AgentProgress | null => {
  const phasePatterns: Array<[RegExp, AgentProgress["labelKey"]]> = [
    [/\[Codex\] Analyzing inputs and planning/i, "canvas.runConsole.phasePlanning"],
    [/\[Codex\] Inspecting the workspace/i, "canvas.runConsole.phaseInspecting"],
    [/\[Codex\] Using an assigned tool/i, "canvas.runConsole.phaseTool"],
    [/\[Codex\] Checking external context/i, "canvas.runConsole.phaseExternal"],
    [/\[Codex\] Preparing workspace changes/i, "canvas.runConsole.phasePreparing"],
    [/\[Codex\] Reviewing the gathered context/i, "canvas.runConsole.phaseReviewing"],
    [/\[Codex\] Finalizing the result/i, "canvas.runConsole.phaseFinalizing"],
  ];

  for (const log of [...logs].reverse()) {
    for (const [pattern, labelKey] of phasePatterns) {
      if (!pattern.test(log)) continue;
      const actionMatch = /\(action (\d+)\)/i.exec(log);

      return { labelKey, action: actionMatch ? Number(actionMatch[1]) : undefined };
    }
  }

  return null;
};

const formatDuration = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;

  return minutes > 0 ? `${minutes}:${remainder.toString().padStart(2, "0")}` : `${remainder}s`;
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
    const message = log.replace(/^\[[^\]]+\]\s*/, "");
    if (!message.startsWith(STRUCTURED_LOG_PREFIX)) continue;
    if (message.startsWith("@@NODE_START::")) {
      callbacks.onNodeStart(message.slice("@@NODE_START::".length));
    } else if (message.startsWith("@@NODE_DONE::")) {
      callbacks.onNodeDone(message.slice("@@NODE_DONE::".length));
    } else if (message.startsWith("@@NODE_FAIL::")) {
      callbacks.onNodeFail(message.slice("@@NODE_FAIL::".length));
    } else if (message.startsWith("@@LLM_CONTENT::")) {
      const rest = message.slice("@@LLM_CONTENT::".length);
      const separatorIndex = rest.indexOf("::");
      if (separatorIndex !== -1) {
        callbacks.onLlmContent(rest.slice(0, separatorIndex), rest.slice(separatorIndex + 2));
      }
    }
  }
};

const isStructuredLog = (log: string): boolean => {
  const message = log.replace(/^\[[^\]]+\]\s*/, "");

  return message.startsWith(STRUCTURED_LOG_PREFIX);
};

const isTerminalStatus = (status: JobStatus) =>
  status === "done" ||
  status === "failed" ||
  status === "cancelled" ||
  status === "expired" ||
  status === "skipped";

export const RunConsole = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const jobId = useStore(store, (state) => state.activeJobId);
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const handleCloseConsole = useStore(store, (state) => state.handleCloseConsole);
  const markNodeRunning = useStore(store, (state) => state.markNodeRunning);
  const markNodePassed = useStore(store, (state) => state.markNodePassed);
  const markNodeFailed = useStore(store, (state) => state.markNodeFailed);
  const applyNodeLlmContent = useStore(store, (state) => state.applyNodeLlmContent);
  const stopTestRun = useStore(store, (state) => state.stopTestRun);
  const handleRunTest = useStore(store, (state) => state.handleRunTest);
  const handleCancelRun = useStore(store, (state) => state.handleCancelRun);
  const isRunning = useStore(store, (state) => state.isRunning);
  const isCancellingRun = useStore(store, (state) => state.isCancellingRun);
  const isConsoleCollapsed = useStore(store, (state) => state.isConsoleCollapsed);
  const handleToggleConsoleCollapse = useStore(store, (state) => state.handleToggleConsoleCollapse);
  const getDataProvider = useDataProvider();
  const dataProvider = getDataProvider();

  const scrollRef = useRef<HTMLDivElement>(null);
  const processedTraceRef = useRef({ jobId: null as string | null, count: 0 });
  const isConsoleCollapsedRef = useRef(isConsoleCollapsed);
  const [now, setNow] = useState(() => Date.now());
  const [showTechnicalLogs, setShowTechnicalLogs] = useState(false);
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

        if (isTerminalStatus(response.data.status)) stopTestRun();

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
  const isLive = job ? !isTerminalStatus(job.status) : false;

  useEffect(() => {
    if (!isLive) return;
    const timer = globalThis.setInterval(() => setNow(Date.now()), 1000);

    return () => globalThis.clearInterval(timer);
  }, [isLive]);

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
  const nodeLabelById = new Map(
    nodes.map((node) => [node.id, node.data.label ?? node.id] as const),
  );
  const timelineStatusByNodeId = new Map(
    runTimeline.timeline.map((item) => [item.nodeId, item.status] as const),
  );
  const visibleSteps = nodes.map((node) => ({
    id: node.id,
    label: node.data.label ?? node.id,
    status: (timelineStatusByNodeId.get(node.id) ?? "pending") as VisualStepStatus,
  }));
  const currentNodeLabel =
    runTimeline.currentNodeId === null
      ? t("canvas.runConsole.currentStepIdle")
      : (nodeLabelById.get(runTimeline.currentNodeId) ?? runTimeline.currentNodeId);
  const completedCount = visibleSteps.filter((step) => step.status === "done").length;
  const currentStepIndex = runTimeline.currentNodeId
    ? Math.max(1, visibleSteps.findIndex((step) => step.id === runTimeline.currentNodeId) + 1)
    : Math.min(completedCount + 1, Math.max(visibleSteps.length, 1));
  const progressPercent =
    job?.status === "done"
      ? 100
      : visibleSteps.length > 0
        ? Math.round((completedCount / visibleSteps.length) * 100)
        : 0;
  const displayCurrentStep =
    nodes.length === 0 ? 0 : Math.min(currentStepIndex, Math.max(nodes.length, 1));
  const latestTraceAt = traces.reduce<number | null>((latest, trace) => {
    const traceTime = parseTraceTime(trace);
    if (traceTime === null) return latest;

    return latest === null ? traceTime : Math.max(latest, traceTime);
  }, null);
  const startedAt = job?.startedAt ? new Date(job.startedAt).getTime() : latestTraceAt;
  const elapsedSeconds = startedAt ? (now - startedAt) / 1000 : 0;
  const quietSeconds = latestTraceAt ? (now - latestTraceAt) / 1000 : elapsedSeconds;
  const isWaitingForAgent = isLive && quietSeconds >= WAITING_THRESHOLD_SECONDS;
  const isTakingLonger = isLive && quietSeconds >= SLOW_THRESHOLD_SECONDS;
  const currentParentCount = runTimeline.currentNodeId
    ? edges.filter((edge) => edge.target === runTimeline.currentNodeId).length
    : 0;
  const agentName = parseAgentName(traceLogs);
  const agentProgress = parseAgentProgress(traceLogs);
  const canRetry =
    job?.status === "failed" ||
    job?.status === "cancelled" ||
    job?.status === "expired" ||
    job?.status === "skipped";

  return (
    <section
      aria-label={t("canvas.runConsole.title")}
      className={cn(
        "absolute bottom-0 left-0 right-0 z-30 flex flex-col border-t bg-surface shadow-float transition-[height] duration-200 motion-reduce:transition-none",
        isConsoleCollapsed ? "h-11" : "h-[min(52vh,24rem)] min-h-72",
      )}
      data-testid="canvas-run-console"
    >
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-surface px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-2 ring-1 ring-border",
              isTakingLonger &&
                "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300",
            )}
          >
            {isTakingLonger ? (
              <AlertTriangle className="size-3.5" />
            ) : (
              <Activity className="size-3.5" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-xs">
              <span className="truncate font-semibold">{t("canvas.runConsole.title")}</span>
              {job ? <StatusIcon status={job.status} /> : null}
              {job ? (
                <span className="shrink-0 font-medium">{t(statusLabelKeys[job.status])}</span>
              ) : null}
              {isLive ? (
                <span className="hidden text-muted-foreground sm:inline">
                  · {formatDuration(elapsedSeconds)}
                </span>
              ) : null}
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              {job
                ? t("canvas.runConsole.headerSummary", {
                    current: displayCurrentStep,
                    total: nodes.length,
                    logs: traceLogs.length,
                  })
                : t("canvas.runConsole.loading")}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isLive ? (
            <Button
              aria-label={
                isCancellingRun ? t("canvas.runConsole.cancelling") : t("canvas.runConsole.cancel")
              }
              className="h-7 gap-1.5 px-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={isCancellingRun}
              size="sm"
              variant="ghost"
              onClick={handleCancelRun}
            >
              {isCancellingRun ? (
                <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
              ) : (
                <Square className="size-3 fill-current" />
              )}
              <span className="hidden sm:inline">
                {isCancellingRun
                  ? t("canvas.runConsole.cancelling")
                  : t("canvas.runConsole.cancel")}
              </span>
            </Button>
          ) : null}
          {canRetry ? (
            <Button
              className="h-7 gap-1.5 px-2 text-xs"
              disabled={isRunning}
              size="sm"
              variant="outline"
              onClick={handleRunTest}
            >
              <RotateCcw className="size-3.5" />
              <span className="hidden sm:inline">{t("canvas.runConsole.retry")}</span>
            </Button>
          ) : null}
          <Button
            aria-label={
              isConsoleCollapsed ? t("canvas.runConsole.expand") : t("canvas.runConsole.collapse")
            }
            className="size-7"
            size="icon"
            variant="ghost"
            onClick={handleToggleConsoleCollapse}
          >
            {isConsoleCollapsed ? (
              <ChevronUp className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </Button>
          {!isLive ? (
            <Button
              aria-label={t("canvas.runConsole.close")}
              className="size-7"
              size="icon"
              variant="ghost"
              onClick={handleCloseConsole}
            >
              <X className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </header>

      {!isConsoleCollapsed ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-3 p-3 sm:p-4">
            {!job ? (
              <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
                {t("canvas.runConsole.loading")}
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
                <div className="space-y-3">
                  <section className="rounded-lg bg-surface-2 p-4 ring-1 ring-border/80">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          {t("canvas.runConsole.currentStep")}
                        </p>
                        <h2 className="mt-1 truncate text-base font-semibold text-foreground">
                          {currentNodeLabel}
                        </h2>
                        <p
                          aria-live="polite"
                          className={cn(
                            "mt-1.5 flex items-center gap-1.5 text-xs",
                            isTakingLonger
                              ? "text-amber-700 dark:text-amber-300"
                              : "text-muted-foreground",
                          )}
                          role="status"
                        >
                          {isTakingLonger ? (
                            <AlertTriangle className="size-3.5 shrink-0" />
                          ) : isLive ? (
                            <span className="relative flex size-2 shrink-0">
                              <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-400 opacity-50 motion-reduce:animate-none" />
                              <span className="relative inline-flex size-2 rounded-full bg-blue-500" />
                            </span>
                          ) : null}
                          <span>
                            {isTakingLonger
                              ? t("canvas.runConsole.activitySlow")
                              : isWaitingForAgent
                                ? t("canvas.runConsole.activityWaiting", {
                                    agent: agentName ?? t("canvas.runConsole.agentFallback"),
                                  })
                                : isLive
                                  ? t("canvas.runConsole.activityActive")
                                  : t(statusLabelKeys[job.status])}
                          </span>
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-lg font-semibold tabular-nums">
                          {displayCurrentStep}
                          <span className="text-xs font-normal text-muted-foreground">
                            /{nodes.length}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {t("canvas.runConsole.stepUnit")}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-border/70">
                      <div
                        aria-label={t("canvas.runConsole.progressLabel", {
                          completed: completedCount,
                          total: nodes.length,
                        })}
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={progressPercent}
                        className="h-full rounded-full bg-foreground transition-[width] duration-300 motion-reduce:transition-none"
                        role="progressbar"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock3 className="size-3.5" />
                        <span>{t("canvas.runConsole.elapsed")}</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {formatDuration(elapsedSeconds)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Activity className="size-3.5" />
                        <span>{t("canvas.runConsole.lastActivity")}</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {t("canvas.runConsole.secondsAgo", {
                            count: Math.max(0, Math.floor(quietSeconds)),
                          })}
                        </span>
                      </div>
                      {agentName ? (
                        <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground sm:col-span-1">
                          <Terminal className="size-3.5" />
                          <span>{t("canvas.runConsole.executor")}</span>
                          <span className="truncate font-medium text-foreground">{agentName}</span>
                        </div>
                      ) : null}
                    </div>

                    {agentProgress ? (
                      <div
                        aria-live="polite"
                        className="mt-3 flex items-center gap-2 rounded-md bg-blue-500/8 px-2.5 py-2 text-[11px] text-blue-800 ring-1 ring-blue-500/15 dark:text-blue-200"
                        role="status"
                      >
                        <Activity className="size-3.5 shrink-0" />
                        <span className="shrink-0 text-blue-700/70 dark:text-blue-300/70">
                          {t("canvas.runConsole.latestProgress")}
                        </span>
                        <span className="min-w-0 truncate font-medium">
                          {t(agentProgress.labelKey, { action: agentProgress.action })}
                        </span>
                      </div>
                    ) : null}

                    {currentParentCount > 1 ? (
                      <p className="mt-3 rounded-md bg-blue-500/10 px-2.5 py-2 text-[11px] text-blue-700 dark:text-blue-300">
                        {t("canvas.runConsole.waitingForParents", { count: currentParentCount })}
                      </p>
                    ) : null}
                  </section>

                  {isTakingLonger ? (
                    <section
                      className="flex items-start gap-3 rounded-lg bg-amber-500/10 p-3 ring-1 ring-amber-500/20"
                      role="status"
                    >
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                          {t("canvas.runConsole.slowTitle")}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
                          {t("canvas.runConsole.slowDescription")}
                        </p>
                      </div>
                    </section>
                  ) : null}

                  {job.status === "failed" && job.error ? (
                    <section
                      className="rounded-lg bg-destructive/10 p-3 text-destructive ring-1 ring-destructive/20"
                      role="alert"
                    >
                      <p className="text-xs font-semibold">{t("canvas.runConsole.failedTitle")}</p>
                      <p className="mt-1 break-words text-[11px] leading-relaxed">{job.error}</p>
                      <Button
                        className="mt-3 h-7 gap-1.5 px-2 text-xs"
                        disabled={isRunning}
                        size="sm"
                        variant="outline"
                        onClick={handleRunTest}
                      >
                        <RotateCcw className="size-3.5" />
                        {t("canvas.runConsole.retry")}
                      </Button>
                    </section>
                  ) : null}
                </div>

                <section className="rounded-lg bg-surface p-3 ring-1 ring-border/80">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      <ListTree className="size-3.5" />
                      {t("canvas.runConsole.timeline")}
                    </div>
                    <span className="text-[10px] tabular-nums text-muted-foreground">
                      {completedCount}/{nodes.length}
                    </span>
                  </div>
                  <div className="mt-2.5 space-y-1">
                    {visibleSteps.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        {t("canvas.runConsole.timelineEmpty")}
                      </span>
                    ) : (
                      visibleSteps.map((step, index) => (
                        <div
                          key={step.id}
                          className={cn(
                            "flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs",
                            step.status === "running" &&
                              "bg-blue-500/10 text-blue-700 dark:text-blue-300",
                            step.status === "done" && "text-foreground",
                            step.status === "failed" && "bg-destructive/10 text-destructive",
                            step.status === "pending" && "text-muted-foreground/70",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] tabular-nums ring-1 ring-border",
                              step.status === "running" && "bg-blue-500 text-white ring-blue-500",
                              step.status === "done" &&
                                "bg-foreground text-background ring-foreground",
                              step.status === "failed" &&
                                "bg-destructive text-destructive-foreground ring-destructive",
                            )}
                          >
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate font-medium">{step.label}</span>
                          <span className="shrink-0 text-[10px]">
                            {t(timelineStatusLabelKeys[step.status])}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            )}

            {runTimeline.artifacts.length > 0 ? (
              <section className="rounded-lg bg-surface-2 p-3 ring-1 ring-border/80">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  <FileText className="size-3.5" />
                  {t("canvas.runConsole.artifacts")}
                </div>
                <div className="flex flex-col gap-1">
                  {runTimeline.artifacts.map((artifact) => (
                    <code
                      key={artifact.path}
                      className="rounded-md bg-background px-2 py-1.5 font-mono text-[11px] text-foreground ring-1 ring-border/70"
                    >
                      {artifact.path}
                    </code>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-lg bg-surface ring-1 ring-border/80">
              <Button
                aria-expanded={showTechnicalLogs}
                className="h-9 w-full justify-start gap-2 rounded-lg px-3 text-xs"
                variant="ghost"
                onClick={() => setShowTechnicalLogs((visible) => !visible)}
              >
                <ChevronRight
                  className={cn(
                    "size-3.5 transition-transform duration-200 motion-reduce:transition-none",
                    showTechnicalLogs && "rotate-90",
                  )}
                />
                <Terminal className="size-3.5" />
                {t("canvas.runConsole.technicalLogs")}
                <span className="ml-auto text-[10px] font-normal text-muted-foreground">
                  {t("canvas.runConsole.logs", { count: traceLogs.length })}
                </span>
              </Button>
              {showTechnicalLogs ? (
                <div
                  ref={scrollRef}
                  className="max-h-40 overflow-auto border-t border-border/70 p-3 font-mono text-[11px] leading-relaxed"
                >
                  {traceLogs.filter((log) => !isStructuredLog(log)).length === 0 ? (
                    <div className="text-muted-foreground">{t("canvas.runConsole.logsEmpty")}</div>
                  ) : (
                    traceLogs
                      .filter((log) => !isStructuredLog(log))
                      .map((log, index) => (
                        <div key={`${index}-${log}`} className="flex gap-2 py-0.5">
                          <span className="shrink-0 text-muted-foreground tabular-nums">
                            {parseTimestamp(log)}
                          </span>
                          <span
                            className={cn(
                              "break-all text-foreground/80",
                              log.includes("ERROR") && "font-medium text-destructive",
                              log.includes("Pipeline complete") &&
                                "font-medium text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {parseMessage(log)}
                          </span>
                        </div>
                      ))
                  )}
                </div>
              ) : null}
            </section>
          </div>
        </ScrollArea>
      ) : null}
    </section>
  );
};
