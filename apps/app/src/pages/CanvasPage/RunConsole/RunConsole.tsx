import { useCallback, useRef, useEffect } from "react";
import { Terminal, X, ChevronUp, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@repo/ui/button";
import { ScrollArea } from "@repo/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";
import { useCustom, useOne } from "@refinedev/core";
import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../_store";
import { StatusIcon } from "./StatusIcon";
import { ResourceName } from "@/integrations/refine/dataProvider";
import type { JobData, JobStatus } from "./types";

const POLL_INTERVAL = 1500;

const statusLabel: Record<JobStatus, string> = {
  queued: "Queued",
  running: "Running",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
  expired: "Expired",
};

const parseTimestamp = (log: string): string => {
  const match = /^\[([^\]]+)\]/.exec(log);
  if (!match) return "";
  const d = new Date(match[1]);

  return d.toLocaleTimeString("en-US", {
    hour12: false,
    fractionalSecondDigits: 3,
  });
};

const parseMessage = (log: string): string => {
  return log.replace(/^\[[^\]]+\]\s*/, "");
};

const STRUCTURED_LOG_PREFIX = "@@";

const parseStructuredLogs = (
  logs: string[],
  callbacks: {
    onNodeStart: (nodeId: string) => void;
    onNodeDone: (nodeId: string) => void;
    onNodeFail: (nodeId: string) => void;
    onLlmContent: (nodeId: string, content: string) => void;
  }
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
  s === "done" || s === "failed" || s === "cancelled" || s === "expired";

export const RunConsole = () => {
  const store = useHarnessCanvasStore();
  const jobId = useStore(store, (s) => s.activeJobId);
  const handleCloseConsole = useStore(store, (s) => s.handleCloseConsole);
  const markNodeRunning = useStore(store, (s) => s.markNodeRunning);
  const markNodePassed = useStore(store, (s) => s.markNodePassed);
  const markNodeFailed = useStore(store, (s) => s.markNodeFailed);
  const setNodeLlmContent = useStore(store, (s) => s.setNodeLlmContent);
  const stopTestRun = useStore(store, (s) => s.stopTestRun);
  const isConsoleCollapsed = useStore(store, (s) => s.isConsoleCollapsed);
  const handleToggleConsoleCollapse = useStore(store, (s) => s.handleToggleConsoleCollapse);
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
        onLlmContent: setNodeLlmContent,
      });

      requestAnimationFrame(() => {
        if (scrollRef.current && !isConsoleCollapsedRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    },
    [markNodeRunning, markNodePassed, markNodeFailed, setNodeLlmContent]
  );

  const { query: jobQuery } = useOne<JobData>({
    resource: ResourceName.jobs,
    id: jobId ?? "",
    queryOptions: {
      enabled: !!jobId,
      refetchInterval: (query) => {
        const status = (query.state.data?.data as JobData | undefined)?.status;
        if (status && isTerminalStatus(status)) return false;

        return POLL_INTERVAL;
      },
    },
  });

  useEffect(() => {
    const status = jobQuery.data?.data?.status;
    if (status && isTerminalStatus(status)) {
      stopTestRun();
    }
  }, [jobQuery.data?.data?.status, stopTestRun]);

  const job = (jobQuery.data?.data as JobData | undefined) ?? null;
  const jobRef = useRef(job);
  jobRef.current = job;

  const { result: tracesResult } = useCustom<{ traces: Array<{ message: string }> }>({
    url: "jobs/traces",
    method: "get",
    config: { payload: { jobId: jobId ?? "" } },
    queryOptions: {
      enabled: !!jobId,
      refetchInterval: () => {
        if (jobRef.current && isTerminalStatus(jobRef.current.status)) return false;

        return POLL_INTERVAL;
      },
    },
  });

  useEffect(() => {
    const traces = tracesResult.data?.traces;
    if (traces && jobId) {
      const logs = traces.map((trace) => trace.message);
      applyStructuredTraceLogs(jobId, logs);
    }
  }, [tracesResult.data?.traces, jobId, applyStructuredTraceLogs]);
  const traceLogs = (tracesResult.data?.traces ?? []).map((trace) => trace.message);

  return (
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 z-30 border-t bg-background shadow-lg transition-all",
        isConsoleCollapsed ? "h-9" : "h-64"
      )}
    >
      {/* Status bar */}
      <div className="flex h-9 items-center justify-between border-b bg-muted/50 px-3">
        <div className="flex items-center gap-2 text-xs">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">Console</span>
          {job && (
            <>
              <span className="text-muted-foreground">|</span>
              <StatusIcon status={job.status} />
              <span
                className={cn(
                  "font-medium",
                  job.status === "running" && "text-blue-600",
                  job.status === "done" && "text-green-600",
                  job.status === "failed" && "text-red-600",
                  job.status === "expired" && "text-slate-600"
                )}
              >
                {statusLabel[job.status]}
              </span>
              {job.status === "running" && (
                <span className="text-muted-foreground">({traceLogs.length} logs)</span>
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
          <div ref={scrollRef} className="h-full overflow-auto p-2 font-mono text-xs">
            {!job && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading...
              </div>
            )}
            {traceLogs
              .filter((l) => !isStructuredLog(l))
              .map((log, i) => (
                <div key={i} className="flex gap-2 py-0.5 hover:bg-muted/30">
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {parseTimestamp(log)}
                  </span>
                  <span
                    className={cn(
                      "break-all",
                      log.includes("ERROR") && "text-red-600 font-medium",
                      log.includes("Pipeline complete") && "text-green-600 font-medium",
                      log.includes("Cloned to") && "text-blue-600",
                      log.includes("Skill output") && "text-violet-600"
                    )}
                  >
                    {parseMessage(log)}
                  </span>
                </div>
              ))}
            {job?.status === "failed" && job.error && (
              <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                {job.error}
              </div>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};
