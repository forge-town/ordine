import { useNavigate } from "@tanstack/react-router";
import { GitBranch, Plus, Clock, ArrowRight, Layers } from "lucide-react";
import { cn } from "@/lib/cn";
import { usePipelinesStore, type Pipeline } from "@/store/pipelinesStore";

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
  pipeline: Pipeline;
  onOpen: () => void;
}

const PipelineCard = ({ pipeline, onOpen }: PipelineCardProps) => {
  const typeCounts = pipeline.nodes.reduce<Record<string, number>>((acc, n) => {
    const t = n.type ?? "unknown";
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="group cursor-pointer rounded-xl border border-gray-200 bg-white p-5 hover:border-violet-300 hover:shadow-md transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-100 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
          <GitBranch className="h-4 w-4" />
        </div>
        <span className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-400">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(pipeline.updatedAt)}
        </span>
      </div>

      {/* Name + desc */}
      <h3 className="mt-3 text-sm font-semibold text-gray-800 group-hover:text-violet-700 transition-colors">
        {pipeline.name}
      </h3>
      <p className="mt-1 text-xs text-gray-400 leading-relaxed line-clamp-2">
        {pipeline.description}
      </p>

      {/* Node type badges */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(typeCounts).map(([type, count]) => (
          <span
            key={type}
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              NODE_TYPE_COLORS[type] ?? "bg-gray-100 text-gray-600",
            )}
          >
            {count} {NODE_TYPE_LABELS[type] ?? type}
          </span>
        ))}
      </div>

      {/* Tags */}
      {pipeline.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {pipeline.tags.map((tag) => (
            <span
              key={tag}
              className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3">
        <span className="text-xs text-gray-400">
          {pipeline.nodes.length} 个节点
        </span>
        <span className="flex items-center gap-1 text-xs font-medium text-violet-500 opacity-0 group-hover:opacity-100 transition-opacity">
          在 Canvas 中打开
          <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
};

export const PipelinesPageContent = () => {
  const pipelines = usePipelinesStore((s) => s.pipelines);
  const setActivePipelineId = usePipelinesStore((s) => s.setActivePipelineId);
  const addPipeline = usePipelinesStore((s) => s.addPipeline);
  const navigate = useNavigate();

  const openPipeline = (id: string) => {
    setActivePipelineId(id);
    void navigate({ to: "/canvas" });
  };

  const createNewPipeline = () => {
    const id = `pipeline-${Date.now()}`;
    const now = Date.now();
    addPipeline({
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
          },
        },
      ],
      edges: [],
    });
    setActivePipelineId(id);
    void navigate({ to: "/canvas" });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Pipelines</h1>
          <p className="text-xs text-gray-400">
            {pipelines.length} 个 Pipeline
          </p>
        </div>
        <button
          onClick={createNewPipeline}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          新建 Pipeline
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {pipelines.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-3 text-center text-gray-400">
            <Layers className="h-8 w-8 text-gray-300" />
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
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
