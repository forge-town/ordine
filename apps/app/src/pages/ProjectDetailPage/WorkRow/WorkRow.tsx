import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import type { WorkEntity } from "@/models/daos/worksDao";

const STATUS_ICONS = {
  pending: Clock,
  running: Loader2,
  success: CheckCircle2,
  failed: XCircle,
} as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "text-gray-500",
  running: "text-blue-500",
  success: "text-emerald-500",
  failed: "text-red-500",
};

export type WorkRowProps = {
  work: WorkEntity;
};

export const WorkRow = ({ work }: WorkRowProps) => {
  const { t } = useTranslation();
  const Icon = STATUS_ICONS[work.status];
  const color = STATUS_COLORS[work.status];
  const statusLabel = t(`work.${work.status}`);
  const objectLabel = t(
    `work.object${work.object.type.charAt(0).toUpperCase()}${work.object.type.slice(1)}`
  );
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 hover:border-primary/50 transition-colors">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/30",
          color
        )}
      >
        <Icon className={cn("h-4 w-4", work.status === "running" && "animate-spin")} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{work.pipelineName}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {objectLabel}
          {work.object.path !== "/" && <span className="ml-1 font-mono">{work.object.path}</span>}
        </p>
      </div>
      <div className="text-right shrink-0">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
            work.status === "success" && "bg-emerald-50 text-emerald-700",
            work.status === "failed" && "bg-red-50 text-red-700",
            work.status === "running" && "bg-blue-50 text-blue-700",
            work.status === "pending" && "bg-gray-100 text-gray-600"
          )}
        >
          {statusLabel}
        </span>
        <p className="mt-1 text-[10px] text-muted-foreground">
          {new Date(work.createdAt).toLocaleString(undefined, {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
};
