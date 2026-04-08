import { useState, useEffect, useRef, useCallback } from "react";
import {
  Terminal,
  X,
  ChevronUp,
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { ScrollArea } from "@repo/ui/scroll-area";
import { cn } from "@repo/ui/lib/utils";

type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled";

interface JobData {
  id: string;
  status: JobStatus;
  logs: string[];
  error: string | null;
  result: { summary?: string } | null;
  startedAt: number | null;
  finishedAt: number | null;
}

export interface RunConsoleProps {
  jobId: string | null;
  onClose?: () => void;
}

const POLL_INTERVAL = 1500;

const StatusIcon = ({ status }: { status: JobStatus }) => {
  switch (status) {
    case "running": {
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />;
    }
    case "done": {
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />;
    }
    case "failed": {
      return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    }
    case "queued": {
      return <Clock className="h-3.5 w-3.5 text-amber-500" />;
    }
    default: {
      return <Terminal className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  }
};

const statusLabel: Record<JobStatus, string> = {
  queued: "Queued",
  running: "Running",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
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

export const RunConsole = ({ jobId, onClose }: RunConsoleProps) => {
  const [job, setJob] = useState<JobData | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isTerminal = useRef(false);

  const fetchJob = useCallback(async (id: string) => {
    const res = await fetch(`/api/jobs/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as JobData;
    setJob(data);

    if (
      data.status === "done" ||
      data.status === "failed" ||
      data.status === "cancelled"
    ) {
      isTerminal.current = true;
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    if (!jobId) {
      setJob(null);
      isTerminal.current = false;
      return;
    }

    isTerminal.current = false;
    void fetchJob(jobId);

    const timer = setInterval(() => {
      if (isTerminal.current) {
        clearInterval(timer);
        return;
      }
      void fetchJob(jobId);
    }, POLL_INTERVAL);

    return () => clearInterval(timer);
  }, [jobId, fetchJob]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current && !collapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [job?.logs.length, collapsed]);

  if (!jobId) return null;

  const handleToggleCollapse = () => setCollapsed((v) => !v);
  const handleClose = () => onClose?.();

  return (
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 z-30 border-t bg-background shadow-lg transition-all",
        collapsed ? "h-9" : "h-64",
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
                )}
              >
                {statusLabel[job.status]}
              </span>
              {job.status === "running" && (
                <span className="text-muted-foreground">
                  ({job.logs.length} logs)
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
            onClick={handleToggleCollapse}
          >
            {collapsed ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            className="h-6 w-6"
            size="icon"
            variant="ghost"
            onClick={handleClose}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Log area */}
      {!collapsed && (
        <ScrollArea className="h-[calc(100%-2.25rem)]">
          <div
            ref={scrollRef}
            className="h-full overflow-auto p-2 font-mono text-xs"
          >
            {!job && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading...
              </div>
            )}
            {job?.logs.map((log, i) => (
              <div key={i} className="flex gap-2 py-0.5 hover:bg-muted/30">
                <span className="shrink-0 text-muted-foreground tabular-nums">
                  {parseTimestamp(log)}
                </span>
                <span
                  className={cn(
                    "break-all",
                    log.includes("ERROR") && "text-red-600 font-medium",
                    log.includes("Pipeline complete") &&
                      "text-green-600 font-medium",
                    log.includes("Cloned to") && "text-blue-600",
                    log.includes("Skill output") && "text-violet-600",
                  )}
                >
                  {parseMessage(log)}
                </span>
              </div>
            ))}
            {job?.status === "done" && job.result?.summary && (
              <div className="mt-2 rounded border border-green-200 bg-green-50 px-3 py-2 text-green-700">
                {job.result.summary}
              </div>
            )}
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
