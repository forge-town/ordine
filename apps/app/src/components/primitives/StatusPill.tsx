import {
  Ban,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Clock,
  LoaderCircle,
  RotateCw,
  SkipForward,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import { Icon } from "./Icon";

export const STATUS_PILL_STATUSES = [
  "idle",
  "queued",
  "running",
  "retrying",
  "waitingForUser",
  "done",
  "completed",
  "connected",
  "pass",
  "failed",
  "error",
  "skipped",
  "cancelled",
] as const;

export type StatusPillStatus = (typeof STATUS_PILL_STATUSES)[number];

type StatusPillMeta = {
  className: string;
  icon: LucideIcon;
  label: string;
  spin?: boolean;
};

const STATUS_META: Record<StatusPillStatus, StatusPillMeta> = {
  idle: { className: "status-wash-muted", icon: Circle, label: "Idle" },
  queued: { className: "status-wash-muted", icon: Clock, label: "Queued" },
  running: { className: "status-wash-muted", icon: LoaderCircle, label: "Running", spin: true },
  retrying: { className: "status-wash-muted", icon: RotateCw, label: "Retrying", spin: true },
  waitingForUser: { className: "status-wash-muted", icon: CircleDot, label: "Awaiting you" },
  done: { className: "status-wash-success", icon: CircleCheck, label: "Done" },
  completed: { className: "status-wash-success", icon: CircleCheck, label: "Completed" },
  connected: { className: "status-wash-success", icon: CircleCheck, label: "Connected" },
  pass: { className: "status-wash-success", icon: CircleCheck, label: "Passed" },
  failed: { className: "status-wash-error", icon: CircleAlert, label: "Failed" },
  error: { className: "status-wash-error", icon: CircleAlert, label: "Error" },
  skipped: { className: "status-wash-muted", icon: SkipForward, label: "Skipped" },
  cancelled: { className: "status-wash-muted", icon: Ban, label: "Cancelled" },
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
        "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        meta.className,
        className,
      )}
    >
      <Icon className={meta.spin ? "spin" : undefined} icon={meta.icon} size={10} />
      {label ?? meta.label}
    </span>
  );
};
