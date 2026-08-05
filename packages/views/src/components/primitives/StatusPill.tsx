import {
  Archive,
  Ban,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Clock,
  LoaderCircle,
  Pause,
  RotateCw,
  SkipForward,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Icon } from "./Icon";

export const STATUS_PILL_STATUSES = [
  "idle",
  "draft",
  "ready",
  "queued",
  "running",
  "retrying",
  "waitingForUser",
  "paused",
  "done",
  "completed",
  "connected",
  "pass",
  "failed",
  "error",
  "skipped",
  "cancelled",
  "expired",
  "archived",
] as const;

export type StatusPillStatus = (typeof STATUS_PILL_STATUSES)[number];

type StatusPillMeta = {
  className: string;
  icon: LucideIcon;
  label: string;
  spin?: boolean;
};

const STATUS_META: Record<StatusPillStatus, StatusPillMeta> = {
  archived: { className: "status-wash-muted", icon: Archive, label: "Archived" },
  cancelled: { className: "status-wash-muted", icon: Ban, label: "Cancelled" },
  completed: { className: "status-wash-success", icon: CircleCheck, label: "Completed" },
  connected: { className: "status-wash-success", icon: CircleCheck, label: "Connected" },
  done: { className: "status-wash-success", icon: CircleCheck, label: "Done" },
  error: { className: "status-wash-error", icon: CircleAlert, label: "Error" },
  expired: { className: "status-wash-muted", icon: Clock, label: "Expired" },
  failed: { className: "status-wash-error", icon: CircleAlert, label: "Failed" },
  draft: { className: "status-wash-muted", icon: Circle, label: "Draft" },
  idle: { className: "status-wash-muted", icon: Circle, label: "Idle" },
  pass: { className: "status-wash-success", icon: CircleCheck, label: "Passed" },
  paused: { className: "status-wash-muted", icon: Pause, label: "Paused" },
  queued: { className: "status-wash-muted", icon: Clock, label: "Queued" },
  ready: { className: "status-wash-success", icon: CircleCheck, label: "Ready" },
  retrying: { className: "status-wash-muted", icon: RotateCw, label: "Retrying", spin: true },
  running: { className: "status-wash-muted", icon: LoaderCircle, label: "Running", spin: true },
  skipped: { className: "status-wash-muted", icon: SkipForward, label: "Skipped" },
  waitingForUser: { className: "status-wash-muted", icon: CircleDot, label: "Awaiting you" },
};

export type StatusPillProps = {
  className?: string;
  label?: string;
  status: StatusPillStatus;
};

export const StatusPill = ({ className, label, status }: StatusPillProps) => {
  const meta = STATUS_META[status];

  return (
    <span
      className={cn(
        "inline-flex min-h-5 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        meta.className,
        className,
      )}
    >
      <Icon className={meta.spin ? "animate-spin" : undefined} icon={meta.icon} size={10} />
      {label ?? meta.label}
    </span>
  );
};
