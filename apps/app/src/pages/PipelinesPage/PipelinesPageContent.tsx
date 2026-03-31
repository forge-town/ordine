import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  GitBranch,
  Plus,
  Clock,
  ArrowRight,
  Layers,
  Trash2,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import { Card } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { cn } from "@repo/ui/lib/utils";
import { Route } from "@/routes/pipelines";
import { createPipeline, deletePipeline } from "@/services/pipelinesService";
import type { StoredPipeline } from "@/models/daos/pipelinesDao";

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

const formatRelativeTime = (ts: number): string => {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
};

interface PipelineCardProps {
  pipeline: StoredPipeline;
  onOpen: () => void;
  onDelete: () => void;
}

const PipelineCard = ({ pipeline, onOpen, onDelete }: PipelineCardProps) => {
  const typeCounts = pipeline.nodes.reduce<Record<string, number>>((acc, n) => {
    const t = n.type ?? "unknown";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="group relative cursor-pointer p-5 hover:border-primary/50 hover:shadow-md transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute right-3 top-3 hidden rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover:flex"
        aria-label="删除"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>

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
            variant="secondary"
            className={cn(
              "rounded-full text-[11px]",
              NODE_TYPE_COLORS[type] ?? "bg-muted text-muted-foreground",
            )}
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
        <span className="text-xs text-muted-foreground">
          {pipeline.nodes.length} 个节点
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          在 Canvas 中打开
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Card>
  );
};

export const PipelinesPageContent = () => {
  const loaderPipelines = Route.useLoaderData();
  const [pipelines, setPipelines] =
    React.useState<StoredPipeline[]>(loaderPipelines);
  const navigate = useNavigate();

  const openPipeline = (id: string) => {
    void navigate({ to: "/canvas", search: { id } });
  };

  const handleCreate = async () => {
    const id = `pipeline-${Date.now()}`;
    const now = Date.now();
    const newPipeline: StoredPipeline = {
      id,
      name: "新建 Pipeline",
      description: "在 Canvas 中配置此 Pipeline 的节点和连接。",
      tags: [],
      nodeCount: 2,
      createdAt: now,
      updatedAt: now,
      nodes: [
        {
          id: `${id}-input`,
          type: "input",
          position: { x: 100, y: 200 },
          data: {
            label: "输入",
            nodeType: "input",
            contextDescription: "",
            exampleValue: "",
          },
        },
        {
          id: `${id}-output`,
          type: "output",
          position: { x: 500, y: 200 },
          data: {
            label: "输出",
            nodeType: "output",
            expectedSchema: "",
            notes: "",
          },
        },
      ],
      edges: [],
    };
    const saved = (await createPipeline({
      data: newPipeline,
    })) as StoredPipeline;
    setPipelines((prev) => [saved, ...prev]);
    void navigate({ to: "/canvas", search: { id: saved.id } });
  };

  const handleDelete = async (id: string) => {
    setPipelines((prev) => prev.filter((p) => p.id !== id));
    await deletePipeline({ data: { id } });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-6">
        <div>
          <h1 className="text-base font-semibold text-foreground">Pipelines</h1>
          <p className="text-xs text-muted-foreground">
            {pipelines.length} 个 Pipeline
          </p>
        </div>
        <Button
          size="sm"
          onClick={() => void handleCreate()}
          className="flex items-center gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          新建 Pipeline
        </Button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {pipelines.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <Layers className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm">
              还没有 Pipeline，点击「新建 Pipeline」开始
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {pipelines.map((p) => (
              <PipelineCard
                key={p.id}
                pipeline={p}
                onOpen={() => openPipeline(p.id)}
                onDelete={() => void handleDelete(p.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
