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
  Copy,
  Check,
} from "lucide-react";
import { useState, useEffect } from "react";
import { ReactFlow, Background, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@repo/ui/lib/utils";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { useOne, useCustomMutation } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import type { OperationRecord, PipelineRecord } from "@repo/db-schema";
import type { PipelineNode } from "@repo/pipeline-engine/schemas";
import { ResourceName } from "@/integrations/refine/dataProvider";
import { Stat } from "../Stat";

interface Props {
  pipeline: PipelineRecord;
  operations: OperationRecord[];
}

// ─── Node type metadata ───────────────────────────────────────────────────────

const NODE_META: Record<string, { icon: React.ElementType; color: string }> = {
  operation: {
    icon: Zap,
    color: "text-violet-600 bg-violet-50",
  },
  "code-file": {
    icon: FileCode,
    color: "text-sky-600 bg-sky-50",
  },
  folder: {
    icon: Folder,
    color: "text-amber-600 bg-amber-50",
  },
  "github-project": {
    icon: FolderGit2,
    color: "text-slate-600 bg-slate-50",
  },
  "output-local-path": {
    icon: HardDrive,
    color: "text-emerald-600 bg-emerald-50",
  },
  "output-project-path": {
    icon: FolderOutput,
    color: "text-teal-600 bg-teal-50",
  },
  condition: {
    icon: GitMerge,
    color: "text-rose-600 bg-rose-50",
  },
};

const getNodeTypeLabel = (type: string, t: (key: string) => string): string => {
  const keyMap: Record<string, string> = {
    operation: "pipelines.nodeTypes.operation",
    "code-file": "pipelines.nodeTypes.code-file",
    folder: "pipelines.nodeTypes.folder",
    "github-project": "pipelines.nodeTypes.github-project",
    "output-local-path": "pipelines.nodeTypes.output-local-path",
    "output-project-path": "pipelines.nodeTypes.output-project-path",
    condition: "pipelines.nodeTypes.condition",
  };
  const key = keyMap[type];

  return key ? t(key) : type;
};

const getNodeLabel = (node: PipelineNode, operations: OperationRecord[]): string => {
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
  const { t } = useTranslation();
  const navigate = useNavigate();

  // ── Run panel state ─────────────────────────────────────────────────────────
  const [inputPath, setInputPath] = useState("");
  const [runState, setRunState] = useState<RunState>("idle");
  const [jobId, setJobId] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const { mutate: runMutate } = useCustomMutation();

  interface JobPollingData {
    status: string;
    logs: string[];
    error: string | null;
    tmuxSessionName: string | null;
  }

  const { query: jobQuery } = useOne<JobPollingData>({
    resource: ResourceName.jobs,
    id: jobId ?? "",
    queryOptions: {
      enabled: !!jobId && runState === "running",
      refetchInterval: (query) => {
        const status = (query.state.data?.data as JobPollingData | undefined)?.status;
        if (status === "done" || status === "failed") return false;

        return 1000;
      },
    },
  });

  const job = jobQuery.data?.data ?? null;
  const logs: string[] = (job?.logs as string[] | undefined) ?? [];
  const tmuxSessionName = job?.tmuxSessionName ?? null;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!job) return;
    if (job.status === "done") {
      setRunState("done");
    } else if (job.status === "failed") {
      setRunState("failed");
      setRunError(job.error ?? "Unknown error");
    }
  }, [job]);

  const handleRun = () => {
    setRunState("running");
    setRunError(null);
    setJobId(null);
    runMutate(
      {
        url: "pipelines/run",
        method: "post",
        values: { id: pipeline.id, inputPath: inputPath || undefined },
      },
      {
        onSuccess: (data) => {
          const result = data?.data as { jobId: string } | undefined;
          if (result?.jobId) {
            setJobId(result.jobId);
          }
        },
        onError: (error) => {
          setRunState("failed");
          setRunError(error.message ?? "Failed to start pipeline");
        },
      }
    );
  };

  const handleInputPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputPath(e.target.value);
  };

  const handleClickRun = () => handleRun();
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
          aria-label={t("pipelines.backToList")}
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
          <Pencil className="h-3.5 w-3.5" />
          {t("pipelines.editInCanvas")}
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
            <Stat icon={Layers} label={t("pipelines.nodeCount")} value={pipeline.nodes.length} />
            <Stat
              icon={Calendar}
              label={t("common.updatedAt")}
              value={new Date(pipeline.updatedAt).toLocaleDateString()}
            />
            <Stat
              icon={Calendar}
              label={t("common.createdAt")}
              value={new Date(pipeline.createdAt).toLocaleDateString()}
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
                    {count} {getNodeTypeLabel(type, t)}
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
              {t("pipelines.preview")}
            </span>
            <Link
              className="text-xs text-violet-600 hover:underline"
              search={{ id: pipeline.id }}
              to="/canvas"
            >
              {t("pipelines.fullscreenEdit")}
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
                {t("pipelines.clickToOpenInCanvas")}
              </span>
            </div>

            {pipeline.nodes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <GitBranch className="h-8 w-8 text-gray-200" />
                <p className="text-sm text-gray-400">{t("pipelines.noStepsYet")}</p>
                <p className="text-xs text-gray-300">{t("pipelines.clickToAdd")}</p>
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
              {t("pipelines.runPipeline")}
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
                {runState === "running" ? t("pipelines.running") : t("pipelines.run")}
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
                    {runState === "running" && t("pipelines.runningStatus")}
                    {runState === "done" && t("pipelines.doneStatus")}
                    {runState === "failed" && `${t("pipelines.failedStatus")}: ${runError ?? ""}`}
                  </span>
                  {jobId && (
                    <span className="ml-auto font-mono text-[10px] text-gray-400">
                      Job: {jobId.slice(0, 8)}
                    </span>
                  )}
                </div>

                {/* Tmux attach command */}
                {tmuxSessionName &&
                  runState === "running" &&
                  (() => {
                    const handleCopyTmuxCommand = () => {
                      navigator.clipboard.writeText(`tmux attach -t ${tmuxSessionName}`);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    };

                    return (
                      <div className="flex items-center gap-2 rounded-md bg-gray-900 px-3 py-1.5">
                        <code className="flex-1 text-[11px] text-green-400 font-mono select-all">
                          tmux attach -t {tmuxSessionName}
                        </code>
                        <button
                          className="text-gray-400 hover:text-white transition-colors"
                          type="button"
                          onClick={handleCopyTmuxCommand}
                        >
                          {copied ? (
                            <Check className="h-3.5 w-3.5 text-green-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })()}

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
                {t("pipelines.nodeList")}
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
                      {getNodeTypeLabel(node.type, t)}
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
