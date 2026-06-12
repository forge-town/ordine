import {
  ArrowRight,
  Boxes,
  Clock,
  FileText,
  FolderOpen,
  GitBranch,
  MessageSquare,
  Play,
  ShieldCheck,
  Sparkles,
  Timer,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";
import type { PipelineData } from "@repo/schemas";
import { Dot, Icon, MiniChain, StatusPill, Tag } from "@/components/primitives";
import { formatDurationMs, timeAgo } from "@/lib/format";

const NODE_TYPE_ICONS: Record<string, LucideIcon> = {
  compound: ShieldCheck,
  file: FileText,
  folder: FolderOpen,
  "github-project": GitBranch,
  operation: Sparkles,
  "output-local-path": Boxes,
  "output-project-path": Boxes,
  prompt: MessageSquare,
};

const formatRelativeTime = (ts: Date | string | null | undefined): string => {
  if (!ts) return "Never";
  const compact = timeAgo(ts);

  return compact === "now" ? "Just now" : `${compact} ago`;
};

const getPipelineSteps = (pipeline: PipelineData) => {
  if (pipeline.nodes.length === 0) {
    return [{ icon: MessageSquare, label: "Draft conversation" }];
  }

  return pipeline.nodes.slice(0, 5).map((node) => ({
    compound: node.data.nodeType === "compound",
    icon: NODE_TYPE_ICONS[node.data.nodeType] ?? Workflow,
    label: node.data.label,
  }));
};

export type PipelineCardStats = {
  avgDurationMs: number | null;
  runs: number;
  successRate: number | null;
};

export type PipelineCardProps = {
  isScheduled: boolean;
  isSavedSkill: boolean;
  pipeline: PipelineData;
  routineLabel?: string;
  stats: PipelineCardStats;
  onOpen: (pipelineId: string) => void;
  onSchedule?: (pipeline: PipelineData) => void;
};

export const PipelineCard = ({
  isScheduled,
  isSavedSkill,
  onOpen,
  onSchedule,
  pipeline,
  routineLabel,
  stats,
}: PipelineCardProps) => {
  const isDraft = pipeline.status === "draft";
  const inputSlots = pipeline.nodes.filter((node) =>
    ["file", "folder", "github-project", "prompt"].includes(node.data.nodeType),
  ).length;
  const handleClick = () => {
    onOpen(pipeline.id);
  };

  return (
    <button
      className="group flex min-h-[230px] flex-col rounded-2xl bg-surface p-4 text-left ring-1 ring-border shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-float hover:ring-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      type="button"
      onClick={handleClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground text-primary-foreground">
          <Icon icon={isDraft ? MessageSquare : Workflow} size={16} />
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {!isDraft && onSchedule ? (
            <span
              className={cn(
                "inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[10px] transition-colors",
                isScheduled
                  ? "bg-foreground text-primary-foreground"
                  : "bg-surface-2 text-muted-foreground hover:bg-accent",
              )}
              data-testid="pipeline-card-schedule"
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onSchedule(pipeline);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onSchedule(pipeline);
                }
              }}
            >
              <Icon icon={Clock} size={10} />
              {isScheduled ? "Routine" : "Schedule"}
            </span>
          ) : isScheduled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[10px] text-primary-foreground">
              <Icon icon={Clock} size={10} />
              Routine
            </span>
          ) : null}
          <StatusPill
            label={isSavedSkill ? "Saved Skill" : isDraft ? "Draft" : "Ready"}
            status={isDraft ? "idle" : "completed"}
          />
        </div>
      </div>

      <div className="mt-3 text-[14px] font-semibold tracking-tightish text-foreground">
        {pipeline.name}
      </div>
      <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted-foreground">
        {pipeline.description || "Draft a new automation flow from this workspace."}
      </p>

      <div className="mt-3.5">
        <MiniChain steps={getPipelineSteps(pipeline)} />
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {routineLabel ? <Tag>{routineLabel}</Tag> : null}
        {inputSlots > 0 ? <Tag>{inputSlots} input slots</Tag> : null}
        {pipeline.tags.slice(0, 3).map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-4 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Icon icon={Play} size={11} />
          {stats.runs} runs
        </span>
        <span className="inline-flex items-center gap-1">
          <Dot tone={stats.successRate === null ? "muted" : "success"} />
          {stats.successRate === null ? "new" : `${stats.successRate}%`}
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon icon={Timer} size={11} />
          {formatDurationMs(stats.avgDurationMs, "-")}
        </span>
        <span className="inline-flex items-center gap-1">
          <Icon icon={GitBranch} size={11} />
          {pipeline.nodes.length}
        </span>
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1 text-foreground opacity-0 transition-opacity group-hover:opacity-100",
          )}
        >
          Open
          <Icon icon={ArrowRight} size={14} />
        </span>
      </div>
      <span className="mt-2 text-[10.5px] text-muted-foreground/70">
        Updated {formatRelativeTime(pipeline.updatedAt)}
      </span>
    </button>
  );
};
