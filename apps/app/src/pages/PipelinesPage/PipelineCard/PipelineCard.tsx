import { GitBranch, Clock, ArrowRight, Trash2, ExternalLink } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useDelete } from "@refinedev/core";
import { Card } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import type { PipelineData } from "@repo/pipeline-engine/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";

const NODE_TYPE_COLORS: Record<string, string> = {
  input: "bg-emerald-100 text-emerald-700",
  skill: "bg-violet-100 text-violet-700",
  condition: "bg-amber-100 text-amber-700",
  output: "bg-blue-100 text-blue-700",
};

const NODE_TYPE_LABELS: Record<string, string> = {
  input: "输入",
  skill: "Skill",
  condition: "条件",
  output: "输出",
};

const formatRelativeTime = (ts: Date | string): string => {
  const date = ts instanceof Date ? ts : new Date(ts);
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);

  return `${days} 天前`;
};

interface PipelineCardProps {
  pipeline: PipelineData;
}

const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
  e.stopPropagation();
};

export const PipelineCard = ({ pipeline }: PipelineCardProps) => {
  const navigate = useNavigate();
  const { mutate: deletePipeline } = useDelete();
  const typeCounts = pipeline.nodes.reduce<Record<string, number>>((acc, n) => {
    const t = n.type ?? "unknown";
    acc[t] = (acc[t] ?? 0) + 1;

    return acc;
  }, {});

  const handleClick = () => {
    void navigate({ to: "/canvas", search: { id: pipeline.id } });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") handleClick();
  };

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    deletePipeline({ resource: ResourceName.pipelines, id: pipeline.id });
  };

  return (
    <Card
      className="group relative cursor-pointer p-5 hover:border-primary/50 hover:shadow-sm transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Delete button */}
      <button
        aria-label="删除"
        className="absolute right-9 top-3 hidden rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:flex"
        onClick={handleDeleteClick}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

      {/* View detail button */}
      <Link
        className="absolute right-3 top-3 hidden rounded p-1 text-muted-foreground hover:bg-accent group-hover:flex"
        params={{ pipelineId: pipeline.id }}
        title="查看详情"
        to="/pipelines/$pipelineId"
        onClick={handleLinkClick}
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>

      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          <GitBranch className="h-4 w-4" />
        </div>
        <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(pipeline.updatedAt)}
        </span>
      </div>

      {/* Name + desc */}
      <h3 className="mt-3 text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
        {pipeline.name}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
        {pipeline.description}
      </p>

      {/* Node type badges */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(typeCounts).map(([type, count]) => (
          <Badge
            key={type}
            className={cn(
              "rounded-full text-[11px]",
              NODE_TYPE_COLORS[type] ?? "bg-muted text-muted-foreground"
            )}
            variant="secondary"
          >
            {count} {NODE_TYPE_LABELS[type] ?? type}
          </Badge>
        ))}
      </div>

      {/* Tags */}
      {pipeline.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {pipeline.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <span className="text-xs text-muted-foreground">{pipeline.nodes.length} 个节点</span>
        <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          在 Canvas 中打开
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Card>
  );
};
