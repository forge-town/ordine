import { useNavigate, Link } from "@tanstack/react-router";
import {
  GitBranch,
  Calendar,
  Tag,
  Layers,
  Pencil,
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
import { useState, useEffect } from "react";
import { ReactFlow, Background, ReactFlowProvider } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { cn } from "@repo/ui/lib/utils";
import { surfaceCardVariants } from "@repo/ui/card";
import { Button } from "@repo/ui/button";
import { Input } from "@repo/ui/input";
import { useOne, useCustomMutation, useList } from "@refinedev/core";
import { useTranslation } from "react-i18next";
import type { Operation, PipelineData, PipelineNode } from "@repo/schemas";
import { ResourceName } from "../../../constants";
import { PageHeader } from "../../../components/PageHeader";
import { PageLoadingState } from "../../../components/PageLoadingState";
import { Stat } from "../Stat";

// ─── Node type metadata ───────────────────────────────────────────────────────

const NODE_META: Record<string, { icon: React.ElementType; color: string }> = {
  operation: {
    icon: Zap,
    color: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  file: {
    icon: FileCode,
    color: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  folder: {
    icon: Folder,
    color: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  "github-project": {
    icon: FolderGit2,
    color: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  },
  "output-local-path": {
    icon: HardDrive,
    color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  "output-project-path": {
    icon: FolderOutput,
    color: "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  },
  condition: {
    icon: GitMerge,
    color: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
};

const getNodeTypeLabel = (type: string, t: (key: string) => string): string => {
  const keyMap: Record<string, string> = {
    operation: "pipelines.nodeTypes.operation",
    file: "pipelines.nodeTypes.file",
    folder: "pipelines.nodeTypes.folder",
    "github-project": "pipelines.nodeTypes.github-project",
    "output-local-path": "pipelines.nodeTypes.output-local-path",
    "output-project-path": "pipelines.nodeTypes.output-project-path",
    condition: "pipelines.nodeTypes.condition",
  };
  const key = keyMap[type];

  return key ? t(key) : type;
};

const getNodeLabel = (node: PipelineNode, operations: Operation[]): string => {
  const data = node.data;
  if (data.nodeType === "operation") {
    const op = operations.find((o) => o.id === data.operationId);

    return op?.name ?? data.operationName ?? data.label ?? node.id;
  }

  return data.label ?? node.id;
};

// ─── Main Component ────────────────────────────────────────────────────────────

type RunState = "idle" | "running" | "done" | "failed";

interface PipelineDetailPageContentProps {
  pipelineId: string;
}

export const PipelineDetailPageContent = ({ pipelineId }: PipelineDetailPageContentProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { result: pipelineResult, query: pipelineQuery } = useOne<PipelineData>({
    resource: ResourceName.pipelines,
    id: pipelineId,
  });
  const { result: operationsResult, query: operationsQuery } = useList<Operation>({
    resource: ResourceName.operations,
  });
  const pipeline = pipelineResult ?? null;
  const operations = operationsResult.data;

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
        values: { id: pipeline!.id, inputPath: inputPath || undefined },
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
      },
    );
  };

  const handleInputPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputPath(e.target.value);
  };

  const handleClickRun = () => handleRun();

  if (pipelineQuery?.isLoading || operationsQuery?.isLoading) {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        <PageHeader title={t("pipelines.title")} />
        <PageLoadingState variant="detail" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("common.notFound")}</p>
      </div>
    );
  }

  const handleCanvasClick = () => void navigate({ to: "/canvas", search: { id: pipeline.id } });
  const handleOpenDistillationStudio = () =>
    void navigate({
      to: "/distillations/new",
      search: {
        sourceType: "pipeline",
        sourceId: pipeline.id,
        sourceLabel: pipeline.name,
        mode: "pipeline",
      },
    });

  const nodeTypeCounts = pipeline.nodes.reduce<Record<string, number>>((acc, n) => {
    acc[n.type] = (acc[n.type] ?? 0) + 1;

    return acc;
  }, {});

  // Build simple left-to-right layout for nodes in the preview
  const previewNodes = pipeline.nodes.map((n, i) => ({
    ...n,
    data: n.data,
    position: { x: i * 220, y: 80 },
    draggable: false,
    selectable: false,
    connectable: false,
  }));

  const previewEdges = pipeline.edges.map((e) => ({
    ...e,
    data: e.data ?? {},
    animated: false as const,
    style: { stroke: "#e5e7eb" },
  }));

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        actions={
          <>
            <Link
              className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground shadow-soft transition-colors hover:bg-accent"
              search={{ id: pipeline.id }}
              to="/canvas"
            >
              <Pencil className="h-3.5 w-3.5" />
              {t("pipelines.editInCanvas")}
            </Link>
            <Button size="sm" variant="outline" onClick={handleOpenDistillationStudio}>
              {t("distillations.openStudio")}
            </Button>
          </>
        }
        backTo="/pipelines"
        title={pipeline.name}
      />

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-8 pt-4 sm:px-7">
        {/* Basic info card */}
        <div className={cn(surfaceCardVariants(), "p-4 sm:p-5")}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/10">
                <GitBranch className="h-5 w-5 text-primary" />
              </div>
              <div>
                {pipeline.description && (
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {pipeline.description}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          {pipeline.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <Tag className="h-3.5 w-3.5 text-muted-foreground" />
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
          <div className="mt-5 grid grid-cols-1 gap-3 border-t border-border pt-4 min-[520px]:grid-cols-3">
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
                      meta?.color ?? "bg-surface-2 text-muted-foreground",
                      "border-current/20",
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
        <div className={cn(surfaceCardVariants(), "overflow-hidden")}>
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-5">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t("pipelines.preview")}
            </span>
            <Link
              className="text-xs font-medium text-primary hover:underline"
              search={{ id: pipeline.id }}
              to="/canvas"
            >
              {t("pipelines.fullscreenEdit")}
            </Link>
          </div>

          <div
            className="group relative h-72 cursor-pointer bg-canvas"
            data-testid="canvas-preview"
            onClick={handleCanvasClick}
          >
            {/* Clickable overlay */}
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-transparent transition-colors group-hover:bg-foreground/5">
              <span className="rounded-full bg-foreground/85 px-4 py-1.5 text-xs font-medium text-background opacity-0 shadow-soft transition-opacity group-hover:opacity-100">
                {t("pipelines.clickToOpenInCanvas")}
              </span>
            </div>

            {pipeline.nodes.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <GitBranch className="h-8 w-8 text-muted-foreground/25" />
                <p className="text-sm text-muted-foreground">{t("pipelines.noStepsYet")}</p>
                <p className="text-xs text-muted-foreground/60">{t("pipelines.clickToAdd")}</p>
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
                  <Background color="var(--canvas-dot)" gap={20} />
                </ReactFlow>
              </ReactFlowProvider>
            )}
          </div>
        </div>

        {/* ── Run panel ─────────────────────────────────────────────────── */}
        <div className={surfaceCardVariants()}>
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 sm:px-5">
            <Play className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {t("pipelines.runPipeline")}
            </span>
          </div>
          <div className="space-y-4 p-4 sm:p-5">
            {/* Input path */}
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <Input
                className="flex-1 font-mono text-xs"
                disabled={runState === "running"}
                placeholder={t("pipelines.inputPathOptional")}
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
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-500 dark:text-blue-400" />
                  )}
                  {runState === "done" && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                  )}
                  {runState === "failed" && (
                    <XCircle className="h-3.5 w-3.5 text-red-500 dark:text-red-400" />
                  )}
                  <span
                    className={cn(
                      "text-xs font-medium",
                      runState === "running" && "text-blue-700 dark:text-blue-300",
                      runState === "done" && "text-emerald-700 dark:text-emerald-300",
                      runState === "failed" && "text-red-700 dark:text-red-300",
                    )}
                  >
                    {runState === "running" && t("pipelines.runningStatus")}
                    {runState === "done" && t("pipelines.doneStatus")}
                    {runState === "failed" && `${t("pipelines.failedStatus")}: ${runError ?? ""}`}
                  </span>
                  {jobId && (
                    <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                      Job: {jobId.slice(0, 8)}
                    </span>
                  )}
                </div>

                {/* Log viewer */}
                {logs.length > 0 && (
                  <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg bg-neutral-950 p-3 font-mono text-[11px] leading-relaxed text-neutral-300 ring-1 ring-white/10">
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
          <div className={surfaceCardVariants()}>
            <div className="border-b border-border px-4 py-3 sm:px-5">
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                {t("pipelines.nodeList")}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {pipeline.nodes.map((node) => {
                const label = getNodeLabel(node, operations);
                const meta = NODE_META[node.type];
                const Icon = meta?.icon ?? Zap;

                return (
                  <li key={node.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                        meta?.color ?? "bg-surface-2 text-muted-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{label}</p>
                      {(() => {
                        const data = node.data;
                        if (data.nodeType !== "operation") return null;
                        const op = operations.find((o) => o.id === data.operationId);

                        return op?.description ? (
                          <p className="truncate text-xs text-muted-foreground">{op.description}</p>
                        ) : null;
                      })()}
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium",
                        meta?.color ?? "bg-surface-2 text-muted-foreground",
                        "border-current/20",
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
