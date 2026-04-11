import { useNavigate, Link } from "@tanstack/react-router";
import {
  GitBranch,
  Calendar,
  Tag,
  Layers,
  Pencil,
  ArrowLeft,
  Zap,
  FileCode,
  Folder,
  FolderGit2,
  HardDrive,
  FolderOutput,
  GitMerge,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  FolderOpen,
} from "lucide-react";
import { useState } from "react";
import { ReactFlow, Background, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { ResultAsync, err, ok } from "neverthrow";
import type { PipelineEntity } from "@/models/daos/pipelinesDao";
import type { OperationEntity } from "@/models/daos/operationsDao";
import type { PipelineNode } from "@/models/types/pipelineGraph";
import { Stat } from "../Stat";

interface Props {
  pipeline: PipelineEntity;
  operations: OperationEntity[];
}

// ─── Node type metadata ───────────────────────────────────────────────────────

const NODE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  operation: {
    label: "操作",
    icon: Zap,
    color: "text-violet-600 bg-violet-50",
  },
  "code-file": {
    label: "代码文件",
    icon: FileCode,
    color: "text-sky-600 bg-sky-50",
  },
  folder: {
    label: "文件夹",
    icon: Folder,
    color: "text-amber-600 bg-amber-50",
  },
  "github-project": {
    label: "GitHub",
    icon: FolderGit2,
    color: "text-slate-600 bg-slate-50",
  },
  "output-local-path": {
    label: "本地输出",
    icon: HardDrive,
    color: "text-emerald-600 bg-emerald-50",
  },
  "output-project-path": {
    label: "项目输出",
    icon: FolderOutput,
    color: "text-teal-600 bg-teal-50",
  },
  condition: {
    label: "条件",
    icon: GitMerge,
    color: "text-rose-600 bg-rose-50",
  },
};

const getNodeLabel = (node: PipelineNode, operations: OperationEntity[]): string => {
  const data = node.data as unknown as Record<string, unknown>;
  if (node.type === "operation") {
    const op = operations.find((o) => o.id === (data.operationId as string));
    return op?.name ?? (data.operationName as string) ?? (data.label as string) ?? node.id;
  }
  return (data.label as string) ?? node.id;
};

// ─── Main Component ────────────────────────────────────────────────────────────

type RunState = "idle" | "running" | "done" | "failed";

export const PipelineDetailPageContent = ({ pipeline, operations }: Props) => {
  const navigate = useNavigate();

  // ── Run panel state ─────────────────────────────────────────────────────────
  const [inputPath, setInputPath] = useState("");
  const [runState, setRunState] = useState<RunState>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [runError, setRunError] = useState<string | null>(null);

  const pollJob = async (id: string) => {
    const poll = async () => {
      const res = await fetch(`/api/jobs/${id}`);
      if (!res.ok) return;
      const job = (await res.json()) as {
        status: string;
        logs: string[];
        error: string | null;
      };
      setLogs(job.logs ?? []);
      if (job.status === "done") {
        setRunState("done");
      } else if (job.status === "failed") {
        setRunState("failed");
        setRunError(job.error ?? "Unknown error");
      } else {
        setTimeout(() => void poll(), 1000);
      }
    };
    await poll();
  };

  const handleRun = async () => {
    setRunState("running");
    setLogs([]);
    setRunError(null);
    setJobId(null);
    const result = await ResultAsync.fromPromise(
      fetch(`/api/pipelines/${pipeline.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputPath: inputPath || undefined }),
      }),
      () => "Failed to start pipeline"
    )
      .andThen((res) =>
        ResultAsync.fromPromise(
          res.json() as Promise<{ jobId?: string; error?: string }>,
          () => "Failed to parse response"
        ).map((data) => ({ res, data }))
      )
      .andThen(({ res, data }) => {
        if (!res.ok) {
          return err(data.error ?? "Failed to start pipeline");
        }
        return ok(data.jobId!);
      });
    await result.match(
      async (id) => {
        setJobId(id);
        await pollJob(id);
      },
      async (errorMsg) => {
        setRunState("failed");
        setRunError(errorMsg);
      }
    );
  };

  const handleInputPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputPath(e.target.value);
  };

  const handleClickRun = () => void handleRun();
  const handleNavigatePipelines = () => void navigate({ to: "/pipelines" });
  const handleCanvasClick = () => void navigate({ to: "/canvas", search: { id: pipeline.id } });

  const nodeTypeCounts = pipeline.nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1;
    return acc;
  }, {});

  // Build simple left-to-right layout for nodes in the preview
  const previewNodes = pipeline.nodes.map((n, i) => ({
    ...n,
    data: n.data as unknown as Record<string, unknown>,
    position: { x: i * 220, y: 80 },
    draggable: false,
    selectable: false,
    connectable: false,
  }));

  const previewEdges = pipeline.edges.map((e) => ({
    ...e,
    data: (e.data ?? {}) as unknown as Record<string, unknown>,
    animated: false as const,
    style: { stroke: "#e5e7eb" },
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-6">
        <button
          aria-label="返回列表"
          className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          onClick={handleNavigatePipelines}
        >
          <ArrowLeft className="h-4 w-4 text-gray-500" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold text-gray-900" role="heading">
            {pipeline.name}
          </h1>
          <p className="font-mono text-[11px] text-gray-400">{pipeline.id}</p>
        </div>
        <Link
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          search={{ id: pipeline.id }}
          to="/canvas"
        >
          <Pencil className="h-3.5 w-3.5" />在 Canvas 中编辑
        </Link>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Basic info card */}
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
              <div>
                {pipeline.description && (
                  <p className="text-sm text-gray-600 leading-relaxed">{pipeline.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          {pipeline.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-gray-400" />
              {pipeline.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Stats row */}
          <div className="mt-5 grid grid-cols-3 gap-4 border-t border-gray-50 pt-4">
            <Stat icon={Layers} label="节点数" value={pipeline.nodes.length} />
            <Stat
              icon={Calendar}
              label="更新时间"
              value={new Date(pipeline.updatedAt).toLocaleDateString("zh-CN")}
            />
            <Stat
              icon={Calendar}
              label="创建时间"
              value={new Date(pipeline.createdAt).toLocaleDateString("zh-CN")}
            />
          </div>

          {/* Node type breakdown */}
          {Object.keys(nodeTypeCounts).length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {Object.entries(nodeTypeCounts).map(([type, count]) => {
                const meta = NODE_META[type];
                const Icon = meta?.icon ?? Zap;
                return (
                  <span
                    key={type}
                    className={cn(
                      "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium",
                      meta?.color ?? "text-gray-600 bg-gray-50",
                      "border-current/20"
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {count} {meta?.label ?? type}
                  </span>
                );
              })}
            </div>
          )}
        </div>

        {/* Canvas preview ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Pipeline 预览
            </span>
            <Link
              className="text-xs text-violet-600 hover:underline"
              search={{ id: pipeline.id }}
              to="/canvas"
            >
              全屏编辑 →
            </Link>
          </div>

          <div
            className="relative h-72 cursor-pointer group"
            data-testid="canvas-preview"
            onClick={handleCanvasClick}
          >
            {/* Clickable overlay */}
            <div className="absolute inset-0 z-10 bg-transparent group-hover:bg-black/5 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-black/70 px-4 py-1.5 text-xs font-medium text-white">
                点击在 Canvas 中打开
              </span>
            </div>

            {pipeline.nodes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <GitBranch className="h-8 w-8 text-gray-200" />
                <p className="text-sm text-gray-400">还没有操作步骤</p>
                <p className="text-xs text-gray-300">点击此处在 Canvas 中添加</p>
              </div>
            ) : (
              <ReactFlowProvider>
                <ReactFlow
                  fitView
                  edges={previewEdges}
                  elementsSelectable={false}
                  fitViewOptions={{ padding: 0.3 }}
                  nodes={previewNodes}
                  nodesConnectable={false}
                  nodesDraggable={false}
                  nodeTypes={{}}
                  panOnDrag={false}
                  panOnScroll={false}
                  preventScrolling={false}
                  proOptions={{ hideAttribution: true }}
                  zoomOnDoubleClick={false}
                  zoomOnScroll={false}
                >
                  <Background color="#f3f4f6" gap={20} />
                </ReactFlow>
              </ReactFlowProvider>
            )}
          </div>
        </div>

        {/* ── Run panel ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
            <Play className="h-3.5 w-3.5 text-gray-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              执行流水线
            </span>
          </div>
          <div className="p-5 space-y-4">
            {/* Input path */}
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 shrink-0 text-gray-400" />
              <Input
                className="flex-1 font-mono text-xs"
                disabled={runState === "running"}
                placeholder="/path/to/your/file-or-folder (可选)"
                value={inputPath}
                onChange={handleInputPathChange}
              />
              <Button
                className="shrink-0 gap-1.5"
                disabled={runState === "running"}
                size="sm"
                onClick={handleClickRun}
              >
                {runState === "running" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {runState === "running" ? "执行中…" : "运行"}
              </Button>
            </div>

            {/* Status */}
            {runState !== "idle" && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  {runState === "running" && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500" />
                  )}
                  {runState === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                  {runState === "failed" && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                  <span
                    className={cn(
                      "text-xs font-medium",
                      runState === "running" && "text-blue-600",
                      runState === "done" && "text-green-600",
                      runState === "failed" && "text-red-600"
                    )}
                  >
                    {runState === "running" && "正在执行…"}
                    {runState === "done" && "执行完成"}
                    {runState === "failed" && `执行失败: ${runError ?? ""}`}
                  </span>
                  {jobId && (
                    <span className="ml-auto font-mono text-[10px] text-gray-400">
                      Job: {jobId.slice(0, 8)}
                    </span>
                  )}
                </div>

                {/* Log viewer */}
                {logs.length > 0 && (
                  <div className="rounded-lg bg-gray-950 p-3 font-mono text-[11px] leading-relaxed text-gray-300 overflow-y-auto max-h-48 space-y-0.5">
                    {logs.map((line, i) => (
                      <div key={i} className="whitespace-pre-wrap break-all">
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Node list ──────────────────────────────────────────────────── */}
        {pipeline.nodes.length > 0 && (
          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                节点列表
              </span>
            </div>
            <ul className="divide-y divide-gray-50">
              {pipeline.nodes.map((node) => {
                const label = getNodeLabel(node, operations);
                const meta = NODE_META[node.type];
                const Icon = meta?.icon ?? Zap;
                return (
                  <li key={node.id} className="flex items-center gap-3 px-5 py-3">
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                        meta?.color ?? "text-gray-600 bg-gray-50"
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{label}</p>
                      {node.type === "operation" &&
                        (() => {
                          const nodeData = node.data as unknown as Record<string, unknown>;
                          const op = operations.find(
                            (o) => o.id === (nodeData["operationId"] as string)
                          );
                          return op?.description ? (
                            <p className="text-xs text-gray-400 truncate">{op.description}</p>
                          ) : null;
                        })()}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium",
                        meta?.color ?? "text-gray-500 bg-gray-50",
                        "border-current/20"
                      )}
                    >
                      {meta?.label ?? node.type}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
