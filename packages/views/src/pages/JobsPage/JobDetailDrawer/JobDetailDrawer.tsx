import { useCustom, useOne } from "@refinedev/core";
import { ExternalLink, Pause, Play, RotateCcw, Square, Workflow, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import {
  type Job,
  type JobTrace,
  type NodeRunStatus,
  type PipelineData,
  normalizeNodeRunStatus,
} from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { cn } from "@repo/ui/lib/utils";
import { ResourceName } from "../../../constants";
import { StatusPill } from "../../../components/primitives";
import { useJobControls } from "../useJobControls";

export type JobDetailDrawerProps = {
  job: Job;
  onClose: () => void;
  onChanged: () => void;
};

const isLive = (status: Job["status"]) =>
  status === "running" || status === "paused" || status === "queued";

const stepTone = (status: NodeRunStatus): string => {
  if (status === "failed") {
    return "ring-destructive/25 bg-destructive/[0.03]";
  }
  if (status === "running" || status === "waitingForUser" || status === "retrying") {
    return "ring-border-strong bg-surface-2/40";
  }

  return "ring-border bg-surface";
};

export const JobDetailDrawer = ({ job: initialJob, onChanged, onClose }: JobDetailDrawerProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { control, pendingKey } = useJobControls();
  const pending = pendingKey !== null;
  const { result: jobResult, query: jobQuery } = useOne<Job>({
    id: initialJob.id,
    queryOptions: { refetchInterval: isLive(initialJob.status) ? 1500 : false },
    resource: ResourceName.jobs,
  });
  const job = jobResult ?? initialJob;
  const { result: pipelineResult } = useOne<PipelineData>({
    id: job.pipelineId ?? "",
    queryOptions: { enabled: Boolean(job.pipelineId) },
    resource: ResourceName.pipelines,
  });
  const { result: tracesResult } = useCustom<{ traces: JobTrace[] }>({
    config: { payload: { jobId: job.id } },
    method: "get",
    queryOptions: {
      refetchInterval: isLive(job.status) ? 1500 : false,
    },
    url: "jobs/traces",
  });
  const traces = tracesResult?.data?.traces ?? [];

  const nodeStatuses = job.nodeStatuses ?? {};
  const steps = (pipelineResult?.nodes ?? []).map((node) => ({
    id: node.id,
    label: node.data.label,
    status: normalizeNodeRunStatus(nodeStatuses[node.id] ?? "idle"),
  }));

  const runControl = (action: "cancel" | "pause" | "rerun" | "resume") => {
    if (action === "rerun" && !job.pipelineId) {
      return;
    }
    control(
      action === "rerun"
        ? { action: "run", pipelineId: job.pipelineId! }
        : { action, jobId: job.id },
      {
        errorTitle: t("jobs.table.actionFailed"),
        onSuccess: () => {
          void jobQuery?.refetch?.();
          onChanged();
        },
      },
    );
  };

  return (
    <div
      className="absolute inset-0 z-50 flex justify-end"
      data-testid="job-detail-drawer"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-foreground/15" />
      <aside
        aria-label={t("jobs.drawer.title")}
        aria-modal="true"
        className="relative flex h-full w-[min(460px,calc(100%_-_1rem))] flex-col bg-background shadow-float ring-1 ring-border-strong"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-border/70 px-5 py-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-foreground text-background">
            <Workflow className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">
              {pipelineResult?.name ?? job.title}
            </div>
            <div className="flex items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
              {job.id}
              {job.startedAt
                ? ` · ${new Date(job.startedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`
                : ""}
            </div>
          </div>
          <StatusPill status={job.status === "expired" ? "cancelled" : job.status} />
          <Button aria-label={t("jobs.drawer.close")} size="icon" variant="ghost" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="flex items-center gap-1.5 border-b border-border/70 px-5 py-3">
          {job.status === "running" ? (
            <Button
              data-testid="job-drawer-pause"
              disabled={pending}
              size="sm"
              variant="outline"
              onClick={() => runControl("pause")}
            >
              <Pause className="size-3" />
              {t("jobs.table.actions.pause")}
            </Button>
          ) : null}
          {job.status === "paused" ? (
            <Button
              data-testid="job-drawer-resume"
              disabled={pending}
              size="sm"
              onClick={() => runControl("resume")}
            >
              <Play className="size-3 fill-current" />
              {t("jobs.table.actions.resume")}
            </Button>
          ) : null}
          {isLive(job.status) ? (
            <Button
              className="text-destructive"
              data-testid="job-drawer-cancel"
              disabled={pending}
              size="sm"
              variant="outline"
              onClick={() => runControl("cancel")}
            >
              <Square className="size-3" />
              {t("jobs.table.actions.cancel")}
            </Button>
          ) : (
            <Button
              data-testid="job-drawer-rerun"
              disabled={pending || !job.pipelineId}
              size="sm"
              onClick={() => runControl("rerun")}
            >
              <RotateCcw className="size-3" />
              {t("jobs.table.actions.rerun")}
            </Button>
          )}
          <div className="ml-auto flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
            {job.totalTokens ? <span>{(job.totalTokens / 1000).toFixed(1)}k tok</span> : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-2 text-[10px] font-semibold uppercase text-muted-foreground">
            {t("jobs.drawer.runtime", { count: steps.length })}
          </div>
          {steps.length === 0 ? (
            <div className="rounded-lg bg-surface-2 p-3 text-xs text-muted-foreground ring-1 ring-border">
              {t("jobs.drawer.noSteps")}
            </div>
          ) : (
            <div className="space-y-1.5">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2.5 ring-1",
                    stepTone(step.status),
                  )}
                  data-testid={`job-drawer-step-${step.id}`}
                >
                  <span className="flex size-5 items-center justify-center font-mono text-[10px] text-muted-foreground">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium">{step.label}</span>
                  <StatusPill status={step.status} />
                </div>
              ))}
            </div>
          )}

          <div className="mb-2 mt-5 text-[10px] font-semibold uppercase text-muted-foreground">
            {t("jobs.drawer.trace")}
          </div>
          <div className="space-y-0.5 rounded-lg bg-surface-2 p-3 font-mono text-[10.5px] leading-relaxed ring-1 ring-border">
            {traces.length === 0 ? (
              <div className="text-muted-foreground/60">{t("jobs.drawer.noTrace")}</div>
            ) : (
              traces.slice(-80).map((trace) => (
                <div key={trace.id} className="break-all text-foreground/70">
                  {trace.message}
                </div>
              ))
            )}
          </div>
          {job.error ? (
            <div className="mt-3 rounded-lg px-3 py-2 text-xs status-wash-error">{job.error}</div>
          ) : null}
        </div>

        <div className="border-t border-border/70 px-5 py-3">
          <Button
            className="w-full"
            data-testid="job-drawer-open-canvas"
            disabled={!job.pipelineId}
            variant="outline"
            onClick={() => {
              if (job.pipelineId) {
                void navigate({
                  search: { id: job.pipelineId },
                  to: "/canvas",
                });
              }
            }}
          >
            <Workflow className="size-3.5" />
            {t("jobs.drawer.openCanvas")}
            <ExternalLink className="size-3" />
          </Button>
        </div>
      </aside>
    </div>
  );
};
