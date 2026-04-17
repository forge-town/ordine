import { useNavigate } from "@tanstack/react-router";
import { MetaRow } from "../MetaRow";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Ban,
  Terminal,
  Info,
  Cpu,
  Code2,
  FileSearch,
  Wand2,
  Layers,
  Link2,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import type { JobRecord, JobStatus, JobType, JobTraceRecord, LogLevel } from "@repo/db-schema";
import { useOne } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Route } from "@/routes/_layout/jobs.$jobId";
import { trpcClient } from "@/integrations/trpc/client";
import { useEffect, useState } from "react";

const STATUS_CONFIG: Record<JobStatus, { icon: React.ElementType; cls: string; bar: string }> = {
  queued: {
    icon: Clock,
    cls: "bg-gray-100 text-gray-700",
    bar: "bg-gray-300",
  },
  running: {
    icon: Loader2,
    cls: "bg-blue-50 text-blue-700",
    bar: "bg-blue-500",
  },
  done: {
    icon: CheckCircle2,
    cls: "bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-500",
  },
  failed: {
    icon: XCircle,
    cls: "bg-red-50 text-red-700",
    bar: "bg-red-500",
  },
  cancelled: {
    icon: Ban,
    cls: "bg-amber-50 text-amber-700",
    bar: "bg-amber-400",
  },
};

const TYPE_CONFIG: Record<JobType, { icon: React.ElementType }> = {
  pipeline_run: { icon: Layers },
  code_analysis: { icon: Code2 },
  skill_execution: { icon: Wand2 },
  file_scan: { icon: FileSearch },
  custom: { icon: Cpu },
};

const getStatusLabel = (status: JobStatus, t: (key: string) => string): string => {
  const statusMap: Record<JobStatus, string> = {
    queued: t("jobs.statusQueued"),
    running: t("jobs.statusRunning"),
    done: t("jobs.statusDone"),
    failed: t("jobs.statusFailed"),
    cancelled: t("jobs.statusCancelled"),
  };

  return statusMap[status];
};

const getJobTypeLabel = (type: JobType, t: (key: string) => string): string => {
  const typeMap: Record<JobType, string> = {
    pipeline_run: t("jobs.typePipeline"),
    code_analysis: t("jobs.typeCodeAnalysis"),
    skill_execution: t("jobs.typeSkillExecution"),
    file_scan: t("jobs.typeFileScan"),
    custom: t("jobs.typeCustom"),
  };

  return typeMap[type];
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
  debug: "text-gray-500",
};

export const JobDetailPageContent = () => {
  const { jobId } = Route.useParams();
  const { result: jobResult } = useOne<JobRecord>({ resource: ResourceName.jobs, id: jobId });
  const job = jobResult ?? null;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [traces, setTraces] = useState<JobTraceRecord[]>([]);

  useEffect(() => {
    void trpcClient.jobs.getTraces.query({ jobId }).then(setTraces);
  }, [jobId]);

  const handleNavigateJobs = () => void navigate({ to: "/jobs" });
  const handleNavigateProject = () => {
    if (!job?.projectId) return;
    void navigate({
      to: "/projects/$projectId",
      params: { projectId: job.projectId },
    });
  };

  if (!job) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <XCircle className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm font-medium text-muted-foreground">{t("common.notFound")}</p>
        <Button size="sm" variant="link" onClick={handleNavigateJobs}>
          {t("common.backToList")}
        </Button>
      </div>
    );
  }

  const s = STATUS_CONFIG[job.status];
  const jobType = TYPE_CONFIG[job.type];
  const StatusIcon = s.icon;
  const TypeIcon = jobType.icon;

  const duration =
    job.startedAt && job.finishedAt
      ? ((job.finishedAt.getTime() - job.startedAt.getTime()) / 1000).toFixed(2) + "s"
      : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-6">
        <Button className="h-8 w-8" size="icon" variant="ghost" onClick={handleNavigateJobs}>
          <ArrowLeft className="h-4 w-4 text-muted-foreground" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-foreground">{job.title}</h1>
          <p className="font-mono text-[11px] text-muted-foreground">{job.id}</p>
        </div>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
            s.cls,
          )}
        >
          <StatusIcon className={cn("h-3.5 w-3.5", job.status === "running" && "animate-spin")} />
          {getStatusLabel(job.status, t)}
        </span>
      </div>

      {/* Status bar */}
      <div className={cn("h-1 w-full shrink-0", s.bar)} />

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Meta card */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            {t("operations.basicInfo")}
          </div>
          <div>
            <MetaRow
              label={t("jobs.type")}
              value={
                (
                  <span className="flex items-center gap-1.5">
                    <TypeIcon className="h-3 w-3" />
                    {getJobTypeLabel(job.type, t)}
                  </span>
                ) as unknown as string
              }
            />
            <MetaRow label={t("jobs.createdAt")} value={new Date(job.createdAt).toLocaleString()} />
            <MetaRow
              label={t("common.startedAt")}
              value={job.startedAt ? new Date(job.startedAt).toLocaleString() : null}
            />
            <MetaRow
              label={t("common.finishedAt")}
              value={job.finishedAt ? new Date(job.finishedAt).toLocaleString() : null}
            />
            <MetaRow label={t("jobs.duration")} value={duration} />
            <MetaRow mono label="Project ID" value={job.projectId} />
            <MetaRow mono label="Pipeline ID" value={job.pipelineId} />
          </div>

          {/* Related links */}
          {job.projectId && (
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              {job.projectId && (
                <Button
                  className="h-auto p-0 text-xs"
                  variant="link"
                  onClick={handleNavigateProject}
                >
                  {t("nav.projects")}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {job.error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <p className="mb-1.5 text-xs font-semibold text-red-600">{t("errors.networkError")}</p>
            <pre className="text-xs text-red-700 font-mono whitespace-pre-wrap break-all">
              {job.error}
            </pre>
          </div>
        )}

        {/* Result */}
        {job.result && Object.keys(job.result).length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("jobs.executionResult")}
            </p>
            <pre className="text-xs text-foreground font-mono whitespace-pre-wrap break-all">
              {JSON.stringify(job.result, null, 2)}
            </pre>
          </div>
        )}

        {/* Traces */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2.5">
            <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-muted-foreground">{t("jobs.logs")}</span>
            <span className="ml-auto text-[11px] text-muted-foreground">{traces.length}</span>
          </div>
          {traces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Terminal className="h-8 w-8 text-muted-foreground/30" />
              <p className="mt-2 text-xs text-muted-foreground">{t("jobs.noLogs")}</p>
            </div>
          ) : (
            <div className="bg-gray-950 p-4 overflow-x-auto max-h-96 overflow-y-auto">
              {traces.map((tr, i) => (
                <div key={tr.id} className="flex gap-3">
                  <span className="shrink-0 w-8 text-right text-[10px] text-gray-600 font-mono select-none">
                    {i + 1}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 w-12 text-[10px] font-mono uppercase",
                      LEVEL_COLOR[tr.level],
                    )}
                  >
                    {tr.level}
                  </span>
                  <span className="text-xs text-gray-200 font-mono whitespace-pre">
                    {tr.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
