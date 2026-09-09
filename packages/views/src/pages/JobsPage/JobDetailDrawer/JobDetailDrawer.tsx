import { useOne } from "@refinedev/core";
import { ExternalLink, RotateCcw, Workflow, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import type { ExecutionJobSummary } from "@repo/schemas";
import { Button } from "@repo/ui/button";
import { ExecutionJobCard } from "../../../components/ExecutionRequest/ExecutionJobCard";
import { terminalStates } from "../../ExecutionWorkspacePage/useJobData";
import { JobStateBadge } from "../JobStateBadge";

export type JobDetailDrawerProps = {
  job: ExecutionJobSummary;
  onClose: () => void;
  onChanged: () => void;
};

export const JobDetailDrawer = ({ job: initialJob, onClose }: JobDetailDrawerProps) => {
  const handleClose = onClose;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { result, query } = useOne<ExecutionJobSummary>({
    dataProviderName: "execution",
    resource: "job-summaries",
    id: initialJob.id,
    queryOptions: {
      retry: false,
      refetchInterval: (current) =>
        terminalStates.includes(current.state.data?.data.state ?? "") ? false : 1500,
    },
  });
  const job = result ?? initialJob;
  const handleOpenCanvas = () => void navigate({ to: "/canvas", search: { id: job.pipelineId } });
  const handleRefresh = () => void query.refetch();
  const handleStopPropagation = (event: React.MouseEvent<HTMLElement>) => event.stopPropagation();

  return (
    <div
      className="absolute inset-0 z-50 flex justify-end"
      data-testid="job-detail-drawer"
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-foreground/15" />
      <aside
        aria-label={t("jobs.drawer.title")}
        aria-modal="true"
        className="relative flex h-full w-[min(460px,calc(100%_-_1rem))] flex-col bg-background shadow-float ring-1 ring-border-strong"
        role="dialog"
        onClick={handleStopPropagation}
      >
        <div className="flex items-start gap-3 border-b border-border/70 px-5 py-4">
          <div className="flex size-10 items-center justify-center rounded-lg bg-foreground text-background">
            <Workflow className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{job.pipelineName}</div>
            <div className="break-all font-mono text-[10.5px] text-muted-foreground">
              {job.id} · r{job.pipelineRevision}
            </div>
          </div>
          <JobStateBadge state={job.state} />
          <Button
            aria-label={t("jobs.drawer.close")}
            size="icon"
            variant="ghost"
            onClick={handleClose}
          >
            <X className="size-4" />
          </Button>
        </div>
        <div className="space-y-2 border-b border-border/70 px-5 py-3">
          <p className="break-all font-mono text-[10.5px] text-muted-foreground">
            requestId · {job.requestId}
          </p>
          {terminalStates.includes(job.state) && (
            <Button data-testid="job-drawer-rerun" size="sm" onClick={handleOpenCanvas}>
              <RotateCcw className="size-3" />
              {t("jobs.table.actions.rerun")}
            </Button>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {query.isError && (
            <div className="mb-3 space-y-2 text-xs text-destructive" role="alert">
              <p>{query.error?.message ?? "无法读取任务"}</p>
              <Button size="sm" variant="outline" onClick={handleRefresh}>
                重新加载
              </Button>
            </div>
          )}
          <ExecutionJobCard key={job.id} jobId={job.id} />
        </div>
        <div className="border-t border-border/70 px-5 py-3">
          <Button
            className="w-full"
            data-testid="job-drawer-open-canvas"
            variant="outline"
            onClick={handleOpenCanvas}
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
