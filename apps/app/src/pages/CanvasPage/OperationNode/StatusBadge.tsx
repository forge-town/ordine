import { cn } from "@repo/ui/lib/utils";
import { Circle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import type { NodeRunStatus } from "@repo/pipeline-engine/schemas";

const statusConfig: Record<
  NodeRunStatus,
  { icon: React.ElementType; color: string; label: string }
> = {
  idle: { icon: Circle, color: "text-gray-400", label: "待运行" },
  running: {
    icon: Loader2,
    color: "text-blue-500 animate-spin",
    label: "运行中",
  },
  pass: { icon: CheckCircle2, color: "text-green-500", label: "成功" },
  fail: { icon: XCircle, color: "text-red-500", label: "失败" },
};

interface StatusBadgeProps {
  status?: NodeRunStatus;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
  const { icon: StatusIcon, color, label } = statusConfig[status ?? "idle"];

  return (
    <div
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 shadow-sm",
        status === "pass" && "bg-green-50 border-green-100",
        status === "fail" && "bg-red-50 border-red-100",
        status === "running" && "bg-blue-50 border-blue-100",
        (!status || status === "idle") && "bg-white border-slate-100"
      )}
    >
      <StatusIcon className={cn("h-3 w-3 shrink-0", color)} />
      <span className={cn("text-[10px] font-semibold tracking-wide", color)}>
        {label}
      </span>
    </div>
  );
};
