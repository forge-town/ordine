import { ChevronRight, FlaskConical, Layers, RefreshCw, Zap, type LucideIcon } from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import type { Job, JobStatus, JobType } from "@repo/schemas";
import { Dot, Icon, StatusPill, Tag } from "@/components/primitives";
import { StepBar, type StepBarStep } from "../StepBar";

const TYPE_ICON: Record<JobType, LucideIcon> = {
  pipeline_run: Layers,
  distillation_run: FlaskConical,
  refinement_run: RefreshCw,
  operation_run: Zap,
};

const TYPE_LABELS: Record<JobType, string> = {
  pipeline_run: "Pipeline",
  distillation_run: "Distillation",
  refinement_run: "Refinement",
  operation_run: "Operation",
};

const STATUS_TONE: Record<JobStatus, "muted" | "success" | "error" | "warning"> = {
  queued: "muted",
  running: "muted",
  done: "success",
  failed: "error",
  cancelled: "warning",
  expired: "warning",
};

const ROW_WASH: Record<JobStatus, string> = {
  queued: "ring-border",
  running: "ring-border",
  done: "ring-border",
  failed: "ring-destructive/25 bg-destructive/[0.03]",
  cancelled: "ring-warning/30 bg-warning/[0.04]",
  expired: "ring-warning/30 bg-warning/[0.04]",
};

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "Queued",
  running: "Running",
  done: "Done",
  failed: "Failed",
  cancelled: "Cancelled",
  expired: "Expired",
};

const formatDuration = (job: Job) => {
  if (!job.startedAt) return "-";
  const end = job.finishedAt ?? new Date();
  const seconds = Math.max(0, Math.round((end.getTime() - job.startedAt.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return `${minutes}m ${rest}s`;
};

const formatTokens = (value: number | null | undefined) => {
  if (!value) return "0";
  if (value >= 1000) return `${Math.round(value / 1000)}k`;

  return String(value);
};

const formatCost = (value: Job["totalCost"]) => {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);

  return `$${parsed.toFixed(2)}`;
};

export const getJobSteps = (job: Job): StepBarStep[] =>
  Object.entries(job.nodeStatuses ?? {}).map(([id, status]) => ({ id, status }));

export const getJobStepLabel = (job: Job) => {
  const steps = getJobSteps(job);
  if (steps.length === 0) return "No node telemetry yet";
  const activeIndex = steps.findIndex((step) =>
    ["queued", "running", "retrying", "waitingForUser", "failed"].includes(step.status),
  );
  const currentIndex = activeIndex >= 0 ? activeIndex : steps.length - 1;
  const current = steps[currentIndex];

  return `Step ${currentIndex + 1}/${steps.length} · ${current?.id ?? "node"} · ${
    current?.status ?? "idle"
  }`;
};

export type JobRowProps = {
  job: Job;
  pipelineName: string;
  onOpen?: (jobId: string) => void;
};

export const JobRow = ({ job, onOpen, pipelineName }: JobRowProps) => {
  const navigate = useNavigate();
  const TypeIcon = TYPE_ICON[job.type] ?? Layers;
  const steps = getJobSteps(job);

  const handleClick = () => {
    if (onOpen) {
      onOpen(job.id);

      return;
    }
    void navigate({ to: "/pipelines/jobs/$jobId", params: { jobId: job.id } });
  };

  return (
    <button
      className={cn(
        "grid w-full grid-cols-[minmax(170px,210px)_minmax(220px,1fr)_120px_86px_118px_92px_24px] items-center gap-3 rounded-xl bg-surface px-3.5 py-3 text-left ring-1 shadow-soft transition-all hover:shadow-float focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        ROW_WASH[job.status],
      )}
      type="button"
      onClick={handleClick}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Dot ping={job.status === "running"} tone={STATUS_TONE[job.status]} />
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold tracking-tightish">
            {pipelineName}
          </div>
          <div className="truncate font-mono text-[10.5px] text-muted-foreground">{job.id}</div>
        </div>
      </div>

      <div className="min-w-0">
        <StepBar steps={steps} />
        <div className="mt-1.5 truncate text-[11px] text-muted-foreground">
          {getJobStepLabel(job)}
        </div>
      </div>

      <Tag className="inline-flex items-center gap-1">
        <Icon icon={TypeIcon} size={10} />
        {TYPE_LABELS[job.type]}
      </Tag>

      <div className="text-[11.5px] tabular-nums text-muted-foreground">{formatDuration(job)}</div>
      <div className="text-[11.5px] tabular-nums text-muted-foreground">
        {formatCost(job.totalCost)} · {formatTokens(job.totalTokens)}
      </div>

      <StatusPill
        label={STATUS_LABEL[job.status]}
        status={job.status === "expired" ? "cancelled" : job.status}
      />

      <ChevronRight className="h-4 w-4 justify-self-end text-muted-foreground" />
    </button>
  );
};
