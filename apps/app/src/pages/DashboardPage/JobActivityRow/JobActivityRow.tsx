import { Link } from "@tanstack/react-router";
import { Clock, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { JobRow } from "@repo/models";

const JOB_STATUS_ICON: Record<string, React.ElementType> = {
  queued: Clock,
  running: Loader2,
  done: CheckCircle2,
  failed: XCircle,
};

const JOB_STATUS_CLS: Record<string, string> = {
  queued: "text-gray-400",
  running: "text-gray-600",
  done: "text-gray-600",
  failed: "text-gray-600",
};

export type JobActivityRowProps = {
  job: JobRow;
};

export const JobActivityRow = ({ job }: JobActivityRowProps) => {
  const Icon = JOB_STATUS_ICON[job.status] ?? Clock;
  return (
    <Link params={{ jobId: job.id }} to="/jobs/$jobId">
      <div className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-accent transition-colors">
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            JOB_STATUS_CLS[job.status],
            job.status === "running" && "animate-spin"
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{job.title}</p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(job.createdAt).toLocaleString(undefined, {
              month: "numeric",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
          {job.status}
        </span>
      </div>
    </Link>
  );
};
