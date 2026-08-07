import { ArrowRight, CalendarClock, Clock, ExternalLink, GitBranch, Trash2 } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useDelete } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { cn } from "@repo/ui/lib/utils";
import type { PipelineData } from "@repo/schemas";
import { ResourceName } from "../../../constants";
import { StatusPill, Tag } from "../../../components/primitives";
import type { PipelineMetrics } from "../pipelineMetrics";

const NODE_TYPE_COLORS: Record<string, string> = {
  input: "bg-emerald-100 text-emerald-700",
  skill: "bg-violet-100 text-violet-700",
  condition: "bg-amber-100 text-amber-700",
  output: "bg-blue-100 text-blue-700",
};

const formatDuration = (durationMs: number | null) => {
  if (durationMs === null) return "--";
  if (durationMs < 1000) return `${durationMs}ms`;
  if (durationMs < 60_000) return `${Math.round(durationMs / 1000)}s`;

  return `${Math.round(durationMs / 60_000)}m`;
};

export interface PipelineCardProps {
  metrics: PipelineMetrics;
  onSchedule?: () => void;
  pipeline: PipelineData;
}

export const PipelineCard = ({ metrics, onSchedule, pipeline }: PipelineCardProps) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { mutate: deletePipeline } = useDelete();
  const typeCounts = pipeline.nodes.reduce<Record<string, number>>((acc, node) => {
    const type = node.type ?? "unknown";
    acc[type] = (acc[type] ?? 0) + 1;

    return acc;
  }, {});
  const updatedAt =
    pipeline.updatedAt instanceof Date ? pipeline.updatedAt : new Date(pipeline.updatedAt);
  const relativeMinutes = Math.round((updatedAt.getTime() - Date.now()) / 60_000);
  const relativeTime = new Intl.RelativeTimeFormat(i18n.language, {
    numeric: "auto",
  }).format(
    Math.abs(relativeMinutes) < 60 ? relativeMinutes : Math.round(relativeMinutes / 60),
    Math.abs(relativeMinutes) < 60 ? "minute" : "hour",
  );

  const handleOpen = () => {
    void navigate({ to: "/canvas", search: { id: pipeline.id } });
  };

  const handleDelete = () => {
    deletePipeline({ resource: ResourceName.pipelines, id: pipeline.id });
  };
  const handleSchedule = () => onSchedule?.();

  return (
    <Card
      interactive
      className="group relative min-h-64 overflow-hidden p-4 focus-within:ring-2 focus-within:ring-ring"
      variant="surface"
    >
      <button
        aria-label={t("pipelines.openPipeline", { name: pipeline.name })}
        className="absolute inset-0 z-0 cursor-pointer"
        type="button"
        onClick={handleOpen}
      />

      <div className="pointer-events-none relative z-10 flex h-full flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <GitBranch className="h-4 w-4" />
          </div>
          <span className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3 shrink-0" />
            <span className="truncate">{relativeTime}</span>
          </span>
        </div>

        <h3 className="mt-3 truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
          {pipeline.name}
        </h3>
        <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed text-muted-foreground">
          {pipeline.description || t("pipelines.noDescription")}
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2 border-y border-border py-3 text-center">
          <div>
            <div className="text-sm font-semibold tabular-nums">{metrics.totalRuns}</div>
            <div className="text-[10px] text-muted-foreground">{t("pipelines.stats.runs")}</div>
          </div>
          <div>
            <div className="text-sm font-semibold tabular-nums">
              {metrics.successRate === null ? "--" : `${Math.round(metrics.successRate * 100)}%`}
            </div>
            <div className="text-[10px] text-muted-foreground">{t("pipelines.stats.success")}</div>
          </div>
          <div>
            <div className="text-sm font-semibold tabular-nums">
              {formatDuration(metrics.avgDurationMs)}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {t("pipelines.stats.avgDuration")}
            </div>
          </div>
        </div>

        <div className="mt-3 flex min-h-5 flex-wrap gap-1.5">
          {metrics.isSavedSkill && <Badge variant="secondary">{t("pipelines.savedSkill")}</Badge>}
          {metrics.isScheduled && <Badge variant="secondary">{t("pipelines.scheduled")}</Badge>}
          {pipeline.status && (
            <StatusPill label={t(`pipelines.status.${pipeline.status}`)} status={pipeline.status} />
          )}
          {Object.entries(typeCounts).map(([type, count]) => (
            <Tag
              key={type}
              className={cn(NODE_TYPE_COLORS[type] ?? "bg-muted text-muted-foreground")}
            >
              {count} {t(`pipelines.nodeTypes.${type}`, { defaultValue: type })}
            </Tag>
          ))}
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
          <span>{t("pipelines.nodes", { count: pipeline.nodes.length })}</span>
          <span className="flex items-center gap-1 font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {t("pipelines.openInCanvas")}
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </div>

      <div className="absolute right-3 top-3 z-20 flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        {onSchedule ? (
          <Button
            aria-label={t("pipelines.schedulePipeline", {
              name: pipeline.name,
            })}
            className="size-7 text-muted-foreground"
            size="icon"
            type="button"
            variant="ghost"
            onClick={handleSchedule}
          >
            <CalendarClock className="h-3.5 w-3.5" />
          </Button>
        ) : null}
        <Button
          aria-label={t("pipelines.deletePipeline", { name: pipeline.name })}
          className="size-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          size="icon"
          type="button"
          variant="ghost"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          aria-label={t("pipelines.viewDetails", { name: pipeline.name })}
          className="size-7 text-muted-foreground"
          nativeButton={false}
          render={<Link params={{ pipelineId: pipeline.id }} to="/pipelines/$pipelineId" />}
          size="icon"
          variant="ghost"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Card>
  );
};
