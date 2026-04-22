import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Ban,
  Trash2,
  ChevronRight,
  Cpu,
  Code2,
  FileSearch,
  Wand2,
  Layers,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { useTranslation } from "react-i18next";
import type { Job, JobStatus, JobType } from "@repo/schemas";

const STATUS_META: Record<JobStatus, { icon: React.ElementType; cls: string; dot: string }> = {
  queued: { icon: Clock, cls: "bg-gray-100 text-gray-600", dot: "bg-gray-400" },
  running: {
    icon: Loader2,
    cls: "bg-blue-50 text-blue-700",
    dot: "bg-blue-500",
  },
  done: {
    icon: CheckCircle2,
    cls: "bg-emerald-50 text-emerald-700",
    dot: "bg-emerald-500",
  },
  failed: { icon: XCircle, cls: "bg-red-50 text-red-700", dot: "bg-red-500" },
  cancelled: {
    icon: Ban,
    cls: "bg-amber-50 text-amber-600",
    dot: "bg-amber-400",
  },
  expired: {
    icon: Clock,
    cls: "bg-slate-100 text-slate-700",
    dot: "bg-slate-400",
  },
};

const TYPE_ICON: Record<JobType, React.ElementType> = {
  pipeline_run: Layers,
  code_analysis: Code2,
  skill_execution: Wand2,
  file_scan: FileSearch,
  custom: Cpu,
};

export type JobRowProps = {
  job: Job;
  onClick: () => void;
  onDelete: () => void;
};

export const JobRow = ({ job, onClick, onDelete }: JobRowProps) => {
  const { t } = useTranslation();
  const s = STATUS_META[job.status];
  const StatusIcon = s.icon;
  const TypeIcon = TYPE_ICON[job.type];
  const TYPE_LABELS: Record<JobType, string> = {
    pipeline_run: t("jobs.typePipeline"),
    code_analysis: t("jobs.typeCodeAnalysis"),
    skill_execution: t("jobs.typeSkillExecution"),
    file_scan: t("jobs.typeFileScan"),
    custom: t("jobs.typeCustom"),
  };
  const duration =
    job.startedAt && job.finishedAt
      ? ((new Date(job.finishedAt).getTime() - new Date(job.startedAt).getTime()) / 1000).toFixed(
          1
        ) + "s"
      : job.startedAt
        ? t("jobs.inProgress")
        : null;

  const handleClick = onClick;
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  return (
    <div
      className="group flex cursor-pointer items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 hover:border-primary/50 hover:shadow-sm transition-all"
      onClick={handleClick}
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", s.cls)}>
        <StatusIcon className={cn("h-4 w-4", job.status === "running" && "animate-spin")} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-foreground">{job.title}</p>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
            <TypeIcon className="h-2.5 w-2.5" />
            {TYPE_LABELS[job.type]}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="font-mono">{job.id}</span>
          {job.projectId && <span className="truncate max-w-30">{job.projectId}</span>}
          {duration && <span>{duration}</span>}
          <span>
            {job.meta?.createdAt?.toLocaleString(undefined, {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }) ?? "-"}
          </span>
        </div>
      </div>
      <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium", s.cls)}>
        {t(`jobs.${job.status}`)}
      </span>
      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          className="h-7 w-7 hover:bg-destructive/10"
          size="icon"
          variant="ghost"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5 text-red-400" />
        </Button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
};
