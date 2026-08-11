import { Link } from "@tanstack/react-router";
import { Clock, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import type { Job } from "@repo/schemas";

const JOB_STATUS_ICON: Record<string, React.ElementType> = {
  queued: Clock,
  running: Loader2,
  done: CheckCircle2,
  failed: XCircle,
};

const JOB_STATUS_CLS: Record<string, string> = {
  queued: "text-muted-foreground",
  running: "text-blue-600 dark:text-blue-400",
  done: "text-emerald-600 dark:text-emerald-400",
  failed: "text-red-600 dark:text-red-400",
};

const JOB_STATUS_LABEL: Record<string, string> = {
  queued: "jobs.statusQueued",
  running: "jobs.statusRunning",
  done: "jobs.statusDone",
  failed: "jobs.statusFailed",
};

export type JobActivityRowProps = {
  job: Job;
};

export const JobActivityRow = ({ job }: JobActivityRowProps) => {
  const { t } = useTranslation();
  const Icon = JOB_STATUS_ICON[job.status] ?? Clock;

  return (
    <Link params={{ jobId: job.id }} to="/pipelines/jobs/$jobId">
      <div className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent">
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            JOB_STATUS_CLS[job.status],
            job.status === "running" && "animate-spin",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {job.meta?.createdAt?.toLocaleString(undefined, {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            }) ?? "-"}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {t(JOB_STATUS_LABEL[job.status] ?? "common.notFound")}
        </span>
      </div>
    </Link>
  );
};
