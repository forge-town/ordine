import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, FileText, Loader2, SquareTerminal, X } from "lucide-react";
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
import { RuntimeEventSchema, type Job, type JobStatus, type RuntimeEvent } from "@repo/schemas";
import { runtimeEventToAgentActivity } from "../../../components/AgentActivityFeed";

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
    onAgentEvent: (nodeId: string, event: RuntimeEvent) => void;
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
    } else if (msg.startsWith("@@AGENT_EVENT::")) {
      const rest = msg.slice("@@AGENT_EVENT::".length);
      const sepIdx = rest.indexOf("::");
      if (sepIdx !== -1) {
        let payload: unknown;
        try {
          payload = JSON.parse(rest.slice(sepIdx + 2)) as unknown;
        } catch {
          continue;
        }
        const parsed = RuntimeEventSchema.safeParse(payload);
        if (parsed.success) callbacks.onAgentEvent(rest.slice(0, sepIdx), parsed.data);
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

export const RunConsole = ({ visible = true }: { visible?: boolean }) => {
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
  const applyNodeAgentActivity = useStore(store, (s) => s.applyNodeAgentActivity);
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
        onAgentEvent: (nodeId, event) =>
          applyNodeAgentActivity(nodeId, runtimeEventToAgentActivity(event)),
      });

      requestAnimationFrame(() => {
        if (scrollRef.current && !isConsoleCollapsedRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    },
    [markNodeRunning, markNodePassed, markNodeFailed, applyNodeLlmContent, applyNodeAgentActivity],
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

  if (!visible) return null;

  return (
    <div
      className="pointer-events-auto absolute inset-x-3 bottom-16 z-30"
      data-testid="canvas-run-console"
    >
      <div className="overflow-hidden rounded-2xl bg-surface shadow-float ring-1 ring-border-strong">
        <div className="flex w-full items-center gap-2 border-b border-border/70 px-3.5 py-2">
          <button
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            data-testid="run-console-toggle"
            type="button"
            onClick={handleToggleConsoleCollapse}
          >
            <span className="flex size-5 items-center justify-center rounded-md bg-surface-2">
              <SquareTerminal className="size-3 text-foreground/75" />
            </span>
            <span className="text-xs font-semibold">{t("canvas.runConsole.title")}</span>
            <span className="rounded-full bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground">
              {t("canvas.runConsole.logs", { count: traceLogs.length })}
            </span>
            {job ? (
              <span className="flex min-w-0 items-center gap-1.5 truncate font-mono text-[10px] text-muted-foreground">
                <StatusIcon status={job.status} />
                <span className="truncate">
                  {jobId} · {t(statusLabelKeys[job.status])}
                </span>
              </span>
            ) : null}
            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
              {isConsoleCollapsed ? (
                <ChevronUp className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
            </span>
          </button>
          <button
            className="rounded-lg p-1 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            aria-label={t("common.close")}
            data-testid="run-console-close"
            type="button"
            onClick={handleCloseConsole}
          >
            <X className="size-3.5" />
          </button>
        </div>
        {!isConsoleCollapsed && (
          <div
            ref={scrollRef}
            className="h-44 overflow-y-auto px-3.5 py-2.5 font-mono text-[10.5px] leading-relaxed"
          >
            {!job && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {t("canvas.runConsole.loading")}
              </div>
            )}
            {job && (
              <div className="mb-2 space-y-1.5 font-sans text-[10px] leading-normal">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("canvas.runConsole.currentStep")}
                  </span>
                  <span className="truncate font-semibold text-foreground">{currentNodeLabel}</span>
                  {runTimeline.latestProgressMessage ? (
                    <span className="min-w-0 truncate text-muted-foreground">
                      {runTimeline.latestProgressMessage}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("canvas.runConsole.timeline")}
                  </span>
                  <span className="text-muted-foreground">
                    {t("canvas.runConsole.timelineCount", {
                      count: runTimeline.timeline.length,
                    })}
                  </span>
                  {runTimeline.timeline.length === 0 ? (
                    <span className="text-muted-foreground">
                      {t("canvas.runConsole.timelineEmpty")}
                    </span>
                  ) : (
                    runTimeline.timeline.map((item) => (
                      <span
                        key={item.nodeId}
                        className={cn(
                          "inline-flex max-w-[220px] items-center gap-1 rounded-full border px-1.5 py-0.5",
                          ["running", "queued", "waitingForUser", "retrying"].includes(
                            item.status,
                          ) && "status-wash-muted",
                          item.status === "done" && "status-wash-success",
                          item.status === "failed" && "status-wash-error",
                        )}
                      >
                        <span className="truncate">
                          {nodeLabelById.get(item.nodeId) ?? item.nodeId}
                        </span>
                        <span className="shrink-0 font-semibold uppercase">
                          {t(timelineStatusLabelKeys[item.status])}
                        </span>
                      </span>
                    ))
                  )}
                </div>

                <div className="rounded-lg bg-surface-2/60 px-2 py-1 text-muted-foreground ring-1 ring-border">
                  {multiInputSummary.count > 0
                    ? t("canvas.runConsole.multiInputRuleWithCount", {
                        count: multiInputSummary.count,
                      })
                    : t("canvas.runConsole.multiInputRule")}
                </div>

                {runTimeline.artifacts.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                    <span className="inline-flex items-center gap-1 font-semibold uppercase tracking-wide">
                      <FileText className="size-3" />
                      {t("canvas.runConsole.artifacts")}
                    </span>
                    {runTimeline.artifacts.map((artifact) => (
                      <code
                        key={artifact.path}
                        className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-foreground"
                      >
                        {artifact.path}
                      </code>
                    ))}
                  </div>
                )}
              </div>
            )}
            {traceLogs
              .filter((l) => !isStructuredLog(l))
              .map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="shrink-0 tabular-nums text-muted-foreground">
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
            {job?.status === "failed" && job.error ? (
              <div className="mt-2 rounded-lg px-2 py-1.5 status-wash-error">{job.error}</div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
