import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Terminal, Loader2, FolderOpen, FileText } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { Textarea } from "@repo/ui/textarea";
import { Card } from "@repo/ui/card";
import { ScrollArea } from "@repo/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@repo/ui/sheet";
import { cn } from "@repo/ui/lib/utils";
import { useCustom, useOne } from "@refinedev/core";
import { useStore } from "zustand";
import { useShallow } from "zustand/shallow";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { FolderBrowser } from "@/components/FolderBrowser/FolderBrowser";
import { useOperationDetailPageStore } from "../_store";

type JobStatus = "queued" | "running" | "done" | "failed" | "cancelled" | "expired";
interface JobData {
  id: string;
  status: JobStatus;
  error: string | null;
}

const POLL_INTERVAL = 1500;

const isTerminalStatus = (s: JobStatus) =>
  s === "done" || s === "failed" || s === "cancelled" || s === "expired";

const parseTimestamp = (log: string): string => {
  const match = /^\[([^\]]+)\]/.exec(log);
  if (!match) return "";
  const d = new Date(match[1]);

  return d.toLocaleTimeString("en-US", { hour12: false, fractionalSecondDigits: 3 });
};

const parseMessage = (log: string): string => log.replace(/^\[[^\]]+\]\s*/, "");

const isStructuredLog = (log: string): boolean => {
  const msg = log.replace(/^\[[^\]]+\]\s*/, "");

  return msg.startsWith("@@");
};

const STATUS_STYLES: Partial<Record<JobStatus, string>> = {
  queued: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

interface OperationRunPanelProps {
  operationId: string;
  operationName: string;
}

export const OperationRunPanel = ({ operationId, operationName }: OperationRunPanelProps) => {
  const { t } = useTranslation();
  const store = useOperationDetailPageStore();
  const {
    runJobId,
    runStatus,
    runInputPath,
    runInputContent,
    isRunPanelOpen,
    handleSetRunInputPath,
    handleSetRunInputContent,
    handleStartRun,
    handleCloseRunPanel,
  } = useStore(
    store,
    useShallow((s) => ({
      runJobId: s.runJobId,
      runStatus: s.runStatus,
      runInputPath: s.runInputPath,
      runInputContent: s.runInputContent,
      isRunPanelOpen: s.isRunPanelOpen,
      handleSetRunInputPath: s.handleSetRunInputPath,
      handleSetRunInputContent: s.handleSetRunInputContent,
      handleStartRun: s.handleStartRun,
      handleCloseRunPanel: s.handleCloseRunPanel,
    })),
  );

  const { result: job } = useOne<JobData>({
    resource: ResourceName.jobs,
    id: runJobId ?? "",
    queryOptions: {
      enabled: !!runJobId,
      refetchInterval: (query) => {
        const status = (query.state.data?.data as JobData | undefined)?.status;
        if (status && isTerminalStatus(status)) return false;

        return POLL_INTERVAL;
      },
    },
  });

  const { result: tracesResult } = useCustom<{ traces: Array<{ message: string }> }>({
    url: "jobs/traces",
    method: "get",
    config: { payload: { jobId: runJobId ?? "" } },
    queryOptions: {
      enabled: !!runJobId,
      refetchInterval: () => {
        if (job && isTerminalStatus(job.status)) return false;

        return POLL_INTERVAL;
      },
    },
  });

  const [isBrowserOpen, setIsBrowserOpen] = useState(false);
  const handleBrowserOpenChange = (open: boolean) => setIsBrowserOpen(open);
  const handleOpenBrowser = () => setIsBrowserOpen(true);
  const handleSheetOpenChange = (open: boolean) => {
    if (!open) handleCloseRunPanel();
  };

  const traceLogs = (tracesResult.data?.traces ?? []).map((trace) => trace.message);
  const displayStatus = job ? job.status : runStatus;
  const isRunning = displayStatus === "running" || runStatus === "running";
  const hasResults = !!runJobId;

  return (
    <Sheet open={isRunPanelOpen} onOpenChange={handleSheetOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md" side="right">
        <SheetHeader>
          <SheetTitle>{t("operations.run.title", "Run Operation")}</SheetTitle>
          <SheetDescription>{operationName}</SheetDescription>
        </SheetHeader>

        {/* Input form */}
        <Card className="mx-4 p-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FolderOpen className="h-3.5 w-3.5" />
                {t("operations.run.inputPath", "File Path")}
              </div>
              <div className="flex gap-1.5">
                <Input
                  className="h-8 flex-1 text-sm"
                  disabled={isRunning}
                  placeholder={t("operations.run.inputPathPlaceholder", "/path/to/file-or-folder")}
                  value={runInputPath}
                  onChange={(e) => handleSetRunInputPath(e.target.value)}
                />
                <Button
                  className="h-8 shrink-0"
                  disabled={isRunning}
                  size="icon"
                  variant="outline"
                  onClick={handleOpenBrowser}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                </Button>
              </div>
              <FolderBrowser
                mode="file"
                open={isBrowserOpen}
                onOpenChange={handleBrowserOpenChange}
                onSelect={handleSetRunInputPath}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                {t("operations.run.inputContent", "Content")}
              </div>
              <Textarea
                className="resize-y text-sm font-mono"
                disabled={isRunning}
                placeholder={t(
                  "operations.run.inputContentPlaceholder",
                  "Or paste content directly...",
                )}
                rows={4}
                value={runInputContent}
                onChange={(e) => handleSetRunInputContent(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              disabled={isRunning || (!runInputPath && !runInputContent)}
              size="sm"
              onClick={() => handleStartRun(operationId)}
            >
              {isRunning ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-1.5 h-4 w-4" />
              )}
              {isRunning
                ? t("operations.run.running", "Running...")
                : t("operations.run.run", "Run")}
            </Button>
          </div>
        </Card>

        {/* Console output */}
        {hasResults && (
          <div className="mx-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-muted/30">
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/60 px-3">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Console</span>
              {job && (
                <span
                  className={cn(
                    "ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium",
                    STATUS_STYLES[job.status],
                  )}
                >
                  {job.status}
                </span>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-3 font-mono text-xs leading-relaxed">
                {!job && runStatus === "running" && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Starting...
                  </div>
                )}
                {traceLogs
                  .filter((l) => !isStructuredLog(l))
                  .map((log, i) => (
                    <div key={i} className="flex gap-2 py-0.5 hover:bg-muted/30">
                      <span className="shrink-0 text-muted-foreground/70 tabular-nums">
                        {parseTimestamp(log)}
                      </span>
                      <span
                        className={cn(
                          "break-all",
                          log.includes("ERROR") && "text-red-600 font-medium",
                          log.includes("completed successfully") && "text-green-600 font-medium",
                          log.includes("Skill output") && "text-violet-600",
                        )}
                      >
                        {parseMessage(log)}
                      </span>
                    </div>
                  ))}
                {job?.status === "failed" && job.error && (
                  <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                    {job.error}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
