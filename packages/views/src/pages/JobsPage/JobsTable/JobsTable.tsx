import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  RefreshCw,
  Square,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { surfaceCardVariants } from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";
import type { ExecutionJobSummary } from "@repo/schemas";
import { JobStateBadge } from "../JobStateBadge";
import { jobActionsForState } from "../jobState";
import { useNavigate } from "@tanstack/react-router";
import { toastStore } from "../../../store/toastStore";
import { useJobControls } from "../useJobControls";

export type JobsTableProps = {
  jobs: ExecutionJobSummary[];
  onChanged: () => void;
  onOpen: (job: ExecutionJobSummary) => void;
};

type JobAction = "cancel" | "pause" | "rerun" | "resume";
type SortDirection = "asc" | "desc";
type SortKey = "duration" | "job" | "started" | "status";

const PAGE_SIZE = 10;
const COLUMNS = "grid-cols-[minmax(220px,1fr)_110px_88px_76px_76px_104px]";

const ACTION_ICON: Record<JobAction, typeof Play> = {
  cancel: Square,
  pause: Pause,
  rerun: RefreshCw,
  resume: Play,
};

const toTimestamp = (value: Date | string | null | undefined) =>
  value ? new Date(value).getTime() : 0;

const formatStarted = (job: ExecutionJobSummary): string =>
  job.startedAt
    ? new Date(job.startedAt).toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const durationMs = (job: ExecutionJobSummary) => {
  if (!job.startedAt) return 0;

  return Math.max(0, (toTimestamp(job.finishedAt) || Date.now()) - toTimestamp(job.startedAt));
};

const formatDuration = (job: ExecutionJobSummary): string => {
  if (!job.startedAt) return "—";
  const milliseconds =
    (job.finishedAt ? toTimestamp(job.finishedAt) : Date.now()) - toTimestamp(job.startedAt);
  const seconds = Math.max(0, milliseconds) / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;

  return `${Math.floor(seconds / 60)}m${String(Math.round(seconds % 60)).padStart(2, "0")}s`;
};

const compareJobs = (a: ExecutionJobSummary, b: ExecutionJobSummary, key: SortKey) => {
  if (key === "started") return toTimestamp(a.startedAt) - toTimestamp(b.startedAt);
  if (key === "duration") return durationMs(a) - durationMs(b);
  if (key === "status") return a.state.localeCompare(b.state);

  const aName = a.pipelineName;
  const bName = b.pipelineName;

  return aName.localeCompare(bName);
};

export const JobsTable = ({ jobs, onChanged, onOpen }: JobsTableProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { control, pendingKey } = useJobControls();
  const [page, setPage] = useState(0);
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [sortKey, setSortKey] = useState<SortKey>("started");
  const handleOpenJob = onOpen;
  const pageCount = Math.max(1, Math.ceil(jobs.length / PAGE_SIZE));

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount]);

  const visibleJobs = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    const sorted = [...jobs].sort((a, b) => compareJobs(a, b, sortKey) * direction);

    return sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [jobs, page, sortDirection, sortKey]);

  const handleSort = (key: SortKey) => {
    setPage(0);
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));

      return;
    }
    setSortKey(key);
    setSortDirection(key === "job" || key === "status" ? "asc" : "desc");
  };

  const handleRunAction = (job: ExecutionJobSummary, action: JobAction) => {
    if (action === "rerun") {
      void navigate({ to: "/canvas", search: { id: job.pipelineId } });

      return;
    }

    control(
      { action, jobId: job.id },
      {
        errorTitle: t("jobs.table.actionFailed"),
        pendingKey: job.id,
        onSuccess: () => {
          toastStore.getState().addToast({
            title: t("jobs.table.controlRequested", "已发送控制请求"),
            type: "success",
          });
          onChanged();
        },
      },
    );
  };
  const handlePreviousPage = () => setPage((current) => Math.max(0, current - 1));
  const handleNextPage = () => setPage((current) => Math.min(pageCount - 1, current + 1));

  const renderSortHeader = (key: SortKey, label: string, align: "left" | "right" = "left") => {
    const active = sortKey === key;
    const SortIcon = !active ? ArrowUpDown : sortDirection === "asc" ? ArrowUp : ArrowDown;

    return (
      <button
        aria-label={t("jobs.table.sortBy", { column: label })}
        className={`flex items-center gap-1 ${align === "right" ? "justify-end text-right" : ""}`}
        type="button"
        onClick={() => handleSort(key)}
      >
        <span>{label}</span>
        <SortIcon className="size-3" />
      </button>
    );
  };

  return (
    <div className={cn(surfaceCardVariants(), "overflow-hidden")} data-testid="jobs-table">
      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div
            className={`grid ${COLUMNS} items-center gap-3 border-b border-border/70 bg-surface-2/50 px-3.5 py-2 text-[10px] font-semibold uppercase text-muted-foreground`}
          >
            {renderSortHeader("job", t("jobs.table.headers.job"))}
            {renderSortHeader("status", t("jobs.table.headers.status"))}
            {renderSortHeader("started", t("jobs.table.headers.started"))}
            {renderSortHeader("duration", t("jobs.table.headers.duration"), "right")}
            <span className="text-right">{t("jobs.table.headers.tokens")}</span>
            <span className="text-right">{t("jobs.table.headers.actions")}</span>
          </div>
          <div className="divide-y divide-border/60">
            {visibleJobs.map((job) => {
              const waiting = job.state === "waiting_for_input";
              const pipelineName = job.pipelineName;

              return (
                <div
                  key={job.id}
                  className={`group grid ${COLUMNS} items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/30`}
                  data-testid={`jobs-table-row-${job.id}`}
                >
                  <button
                    className="flex min-w-0 items-baseline gap-2 text-left"
                    type="button"
                    onClick={() => handleOpenJob(job)}
                  >
                    <span className="truncate text-xs font-medium">{pipelineName}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {job.id}· r{job.pipelineRevision}
                    </span>
                  </button>
                  <div>
                    <JobStateBadge state={job.state} />
                  </div>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatStarted(job)}
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                    {formatDuration(job)}
                  </span>
                  <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                    —
                  </span>
                  <div className="flex items-center justify-end gap-0.5">
                    {waiting ? (
                      <button
                        className="inline-flex items-center gap-1 rounded-md bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90"
                        data-testid={`jobs-action-review-${job.id}`}
                        type="button"
                        onClick={() => handleOpenJob(job)}
                      >
                        <ArrowRight className="size-3" />
                        {t("jobs.table.actions.review")}
                      </button>
                    ) : (
                      jobActionsForState(job.state).map((action) => {
                        const ActionIcon =
                          action === "cancel" && job.state === "queued" ? X : ACTION_ICON[action];
                        const disabled = pendingKey !== null;

                        return (
                          <button
                            key={action}
                            className="rounded-md p-1.5 text-muted-foreground opacity-100 hover:bg-accent hover:text-foreground disabled:opacity-30 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                            data-testid={`jobs-action-${action}-${job.id}`}
                            disabled={disabled}
                            title={t(`jobs.table.actions.${action}`)}
                            type="button"
                            onClick={() => handleRunAction(job, action)}
                          >
                            <ActionIcon className="size-3.5" />
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {pageCount > 1 ? (
        <div className="flex items-center justify-end gap-2 border-t border-border/70 px-3.5 py-2">
          <span className="mr-auto text-[10px] text-muted-foreground">
            {t("jobs.table.page", { current: page + 1, total: pageCount })}
          </span>
          <button
            aria-label={t("jobs.table.previousPage")}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
            disabled={page === 0}
            title={t("jobs.table.previousPage")}
            type="button"
            onClick={handlePreviousPage}
          >
            <ChevronLeft className="size-3.5" />
          </button>
          <button
            aria-label={t("jobs.table.nextPage")}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30"
            disabled={page >= pageCount - 1}
            title={t("jobs.table.nextPage")}
            type="button"
            onClick={handleNextPage}
          >
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
};
