import { useState } from "react";
import { ResultAsync } from "neverthrow";
import { ArrowRight, Pause, Play, RefreshCw, Square, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Job, JobStatus } from "@repo/schemas";
import { dataProvider } from "@/integrations/refine/dataProvider";
import { StatusPill } from "@/components/primitives";
import { toastStore } from "@/store/toastStore";

export type JobsTableProps = {
  jobs: Job[];
  pipelineNameById: Map<string, string>;
  onOpen: (job: Job) => void;
  onChanged: () => void;
};

type JobAction = "cancel" | "pause" | "rerun" | "resume";

const hasWaitingNode = (job: Job) =>
  Object.values(job.nodeStatuses ?? {}).some((status) => status === "waitingForUser");

const actionsForStatus = (status: JobStatus): JobAction[] => {
  if (status === "running") {
    return ["pause", "cancel"];
  }
  if (status === "paused") {
    return ["resume", "cancel"];
  }
  if (status === "queued") {
    return ["cancel"];
  }

  return ["rerun"];
};

const ACTION_ICON: Record<JobAction, typeof Play> = {
  cancel: Square,
  pause: Pause,
  rerun: RefreshCw,
  resume: Play,
};

const formatStarted = (job: Job): string =>
  job.startedAt
    ? new Date(job.startedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : "—";

const formatDuration = (job: Job): string => {
  if (!job.startedAt) {
    return "—";
  }
  const end = job.finishedAt ? new Date(job.finishedAt).getTime() : Date.now();
  const seconds = Math.max(0, (end - new Date(job.startedAt).getTime()) / 1000);
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  return `${Math.floor(seconds / 60)}m${String(Math.round(seconds % 60)).padStart(2, "0")}s`;
};

const formatCost = (job: Job): string =>
  job.totalCost ? `$${Number(job.totalCost).toFixed(2)}` : "—";

export const JobsTable = ({ jobs, onChanged, onOpen, pipelineNameById }: JobsTableProps) => {
  const { t } = useTranslation();
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  const columns = "grid-cols-[minmax(0,1fr)_110px_88px_72px_72px_96px]";

  const runAction = (job: Job, action: JobAction) => {
    setPendingJobId(job.id);
    const request =
      action === "rerun"
        ? dataProvider.custom!({
            method: "post",
            payload: { id: job.pipelineId },
            url: "pipelines/run",
          })
        : dataProvider.custom!({
            method: "post",
            payload: { jobId: job.id },
            url: `jobs/${action}`,
          });

    void ResultAsync.fromPromise(request, () => t("jobs.table.actionFailed")).match(
      () => {
        setPendingJobId(null);
        toastStore.getState().addToast({
          title: t(`jobs.table.actions.${action}Done`, { jobId: job.id }),
          type: "success",
        });
        onChanged();
      },
      (error) => {
        setPendingJobId(null);
        toastStore.getState().addToast({ title: error, type: "error" });
      },
    );
  };

  return (
    <div
      className="overflow-hidden rounded-2xl bg-surface ring-1 ring-border shadow-soft"
      data-testid="jobs-table"
    >
      <div
        className={`grid ${columns} items-center gap-3 border-b border-border/70 bg-surface-2/50 px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground`}
      >
        <span>{t("jobs.table.headers.job")}</span>
        <span>{t("jobs.table.headers.status")}</span>
        <span>{t("jobs.table.headers.started")}</span>
        <span className="text-right">{t("jobs.table.headers.duration")}</span>
        <span className="text-right">{t("jobs.table.headers.cost")}</span>
        <span className="text-right">{t("jobs.table.headers.actions")}</span>
      </div>
      <div className="divide-y divide-border/60">
        {jobs.map((job) => {
          const waiting = hasWaitingNode(job);
          const pipelineName = job.pipelineId
            ? (pipelineNameById.get(job.pipelineId) ?? job.title)
            : job.title;

          return (
            <div
              className={`group grid ${columns} cursor-pointer items-center gap-3 px-3.5 py-2.5 transition-colors hover:bg-accent/30`}
              data-testid={`jobs-table-row-${job.id}`}
              key={job.id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(job)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onOpen(job);
                }
              }}
            >
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="truncate text-xs font-medium">{pipelineName}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                  {job.id}
                  {job.triggeredBy === "routine" ? ` · ${t("jobs.table.byRoutine")}` : ""}
                </span>
              </div>
              <div>
                <StatusPill status={job.status === "expired" ? "cancelled" : job.status} />
              </div>
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatStarted(job)}
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatDuration(job)}
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {formatCost(job)}
              </span>
              <div className="flex items-center justify-end gap-0.5">
                {waiting ? (
                  <button
                    className="inline-flex items-center gap-1 rounded-lg bg-foreground px-2.5 py-1 text-[11px] font-medium text-background hover:opacity-90"
                    data-testid={`jobs-action-review-${job.id}`}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpen(job);
                    }}
                  >
                    <ArrowRight className="size-3" />
                    {t("jobs.table.actions.review")}
                  </button>
                ) : (
                  actionsForStatus(job.status).map((action) => {
                    const ActionIcon = action === "cancel" && job.status === "queued" ? X : ACTION_ICON[action];
                    const disabled =
                      pendingJobId === job.id || (action === "rerun" && !job.pipelineId);

                    return (
                      <button
                        className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground disabled:opacity-30 group-hover:opacity-100"
                        data-testid={`jobs-action-${action}-${job.id}`}
                        disabled={disabled}
                        key={action}
                        title={t(`jobs.table.actions.${action}`)}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          runAction(job, action);
                        }}
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
  );
};
