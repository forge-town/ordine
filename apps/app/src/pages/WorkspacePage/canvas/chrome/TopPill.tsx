import { useMemo, useState } from "react";
import { useUpdate } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import { Bot, ChevronRight, CornerUpLeft, Layers, Play, Square, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import { dataProvider, ResourceName } from "@/integrations/refine/dataProvider";
import { toastStore } from "@/store/toastStore";
import { useWorkspaceStore } from "../../_store/workspaceStore";
import { toPipelineSnapshot, type CanvasEdge, type CanvasNode } from "../_store/canvasTypes";
import { useCanvasStore } from "../_store/canvasStore";
import { StateLegend } from "./StateLegend";
import { VersionMenu, type VersionMenuRunState } from "./VersionMenu";

export type TopPillPipeline = {
  id: string;
  name: string;
  version: number;
};

export type TopPillProps = {
  pipeline: TopPillPipeline;
};

type RunStartResponse = {
  jobId: string;
};

const stableGraphJson = (nodes: readonly CanvasNode[], edges: readonly CanvasEdge[]): string =>
  JSON.stringify({
    edges: edges.map((edge) => ({
      data: edge.data,
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle ?? null,
      target: edge.target,
      targetHandle: edge.targetHandle ?? null,
    })),
    nodes: nodes.map((node) => ({
      data: node.data,
      id: node.id,
      parentId: node.parentId ?? null,
      position: node.position,
      style: node.style ?? null,
      type: node.type,
    })),
  });

export const TopPill = ({ pipeline }: TopPillProps) => {
  const { t } = useTranslation();
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const drillStack = useCanvasStore((state) => state.drillStack);
  const setDrillStack = useCanvasStore((state) => state.setDrillStack);
  const popDrillStack = useCanvasStore((state) => state.popDrillStack);
  const activeJobId = useCanvasStore((state) => state.activeJobId);
  const latestJob = useCanvasStore((state) => state.latestJob);
  const beginRun = useCanvasStore((state) => state.beginRun);
  const agentOpen = useWorkspaceStore((state) => state.agentOpen);
  const setAgentOpen = useWorkspaceStore((state) => state.setAgentOpen);
  const { mutate: updatePipeline } = useUpdate();

  const [renaming, setRenaming] = useState(false);
  const [version, setVersion] = useState(pipeline.version);
  const [isStartingRun, setIsStartingRun] = useState(false);
  const graphJson = useMemo(() => stableGraphJson(nodes, edges), [edges, nodes]);
  const [savedGraphJson, setSavedGraphJson] = useState(graphJson);

  const dirty = graphJson !== savedGraphJson;
  const running = activeJobId !== null;
  const hasOperationNode = nodes.some((node) => node.type === "operation");
  const canRun = hasOperationNode && !running && !isStartingRun;
  const atRoot = drillStack.length === 0;
  const runState: VersionMenuRunState = running
    ? "running"
    : latestJob?.status === "done" && !dirty
      ? "done"
      : "draft";

  const crumbs = useMemo(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]));

    return [
      { id: "root", label: pipeline.name },
      ...drillStack.map((nodeId) => ({
        id: nodeId,
        label:
          (nodeById.get(nodeId)?.data as { label?: string } | undefined)?.label ??
          t("workspace.canvas.chrome.breadcrumb.compoundFallback"),
      })),
    ];
  }, [drillStack, nodes, pipeline.name, t]);

  const persistGraph = (nextVersion: number, successMessage: string) => {
    const snapshot = toPipelineSnapshot({ edges, nodes });
    updatePipeline(
      {
        id: pipeline.id,
        resource: ResourceName.pipelines,
        successNotification: false,
        errorNotification: false,
        values: {
          edges: snapshot.edges,
          nodes: snapshot.nodes,
          version: nextVersion,
        },
      },
      {
        onError: () =>
          toastStore.getState().addToast({
            title: t("workspace.canvas.chrome.version.saveFailed"),
            type: "error",
          }),
        onSuccess: () => {
          setSavedGraphJson(graphJson);
          setVersion(nextVersion);
          toastStore.getState().addToast({
            title: successMessage,
            type: "success",
          });
        },
      },
    );
  };

  const commitRename = (value: string) => {
    setRenaming(false);
    const name = value.trim();
    if (!name || name === pipeline.name) {
      return;
    }

    updatePipeline({
      id: pipeline.id,
      resource: ResourceName.pipelines,
      successNotification: false,
      errorNotification: false,
      values: { name },
    });
  };

  const handleRun = () => {
    setIsStartingRun(true);
    void ResultAsync.fromPromise(
      dataProvider.custom!({
        method: "post",
        payload: { id: pipeline.id },
        url: "pipelines/run",
      }),
      () => t("workspace.canvas.chrome.run.startFailed"),
    ).match(
      (response) => {
        const { jobId } = response.data as RunStartResponse;
        beginRun(jobId);
        setIsStartingRun(false);
        toastStore.getState().addToast({
          description: t("workspace.canvas.chrome.run.startedDescription", { jobId }),
          title: t("workspace.canvas.chrome.run.started"),
          type: "success",
        });
      },
      (error) => {
        setIsStartingRun(false);
        toastStore.getState().addToast({
          title: error,
          type: "error",
        });
      },
    );
  };

  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3"
      data-testid="canvas-v2-top-pill"
    >
      <div className="pointer-events-auto flex min-w-0 items-center gap-2">
        <div className="flex min-w-0 items-center gap-1 rounded-full bg-surface px-2.5 py-1.5 shadow-pill ring-1 ring-border">
          {atRoot ? (
            <Workflow className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Layers className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          {crumbs.map((crumb, index) => {
            const isLast = index === crumbs.length - 1;
            if (index === 0 && renaming) {
              return (
                <input
                  autoFocus
                  className="w-44 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-border-strong"
                  data-testid="canvas-v2-rename-input"
                  defaultValue={crumb.label}
                  key="rename"
                  onBlur={(event) => commitRename(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitRename(event.currentTarget.value);
                    }
                    if (event.key === "Escape") {
                      setRenaming(false);
                    }
                  }}
                />
              );
            }

            return (
              <span className="flex min-w-0 items-center gap-1" key={crumb.id}>
                {index > 0 ? (
                  <ChevronRight className="size-3 shrink-0 text-muted-foreground/50" />
                ) : null}
                <button
                  className={cn(
                    "truncate whitespace-nowrap rounded-full px-1.5 py-0.5 text-xs transition-colors",
                    isLast
                      ? "font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  )}
                  data-testid={`canvas-v2-crumb-${index}`}
                  title={
                    index === 0 ? t("workspace.canvas.chrome.breadcrumb.renameTitle") : undefined
                  }
                  type="button"
                  onClick={() => {
                    if (index === 0 && isLast) {
                      setRenaming(true);
                      return;
                    }
                    setDrillStack(drillStack.slice(0, index));
                  }}
                  onDoubleClick={() => {
                    if (index === 0) {
                      setRenaming(true);
                    }
                  }}
                >
                  {crumb.label}
                </button>
              </span>
            );
          })}
          {atRoot ? (
            <VersionMenu
              dirty={dirty}
              runState={runState}
              version={version}
              onOverwrite={() =>
                persistGraph(version, t("workspace.canvas.chrome.version.saveSuccess", { version }))
              }
              onSaveAsNew={() =>
                persistGraph(
                  version + 1,
                  t("workspace.canvas.chrome.version.saveAsNewSuccess", { version: version + 1 }),
                )
              }
            />
          ) : null}
        </div>
        {!atRoot ? (
          <button
            className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs shadow-pill ring-1 ring-border transition-colors hover:ring-border-strong"
            data-testid="canvas-v2-drill-out"
            type="button"
            onClick={popDrillStack}
          >
            <CornerUpLeft className="size-3.5" />
            {t("workspace.canvas.chrome.breadcrumb.drillOut")}
          </button>
        ) : null}
      </div>

      <div className="pointer-events-auto flex shrink-0 items-center gap-2">
        {atRoot ? <StateLegend /> : null}
        {atRoot ? (
          running ? (
            <button
              className="flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-xs font-medium text-foreground shadow-pill ring-1 ring-border opacity-70"
              data-testid="canvas-v2-stop"
              disabled
              title={t("workspace.canvas.chrome.run.stopUnavailable")}
              type="button"
            >
              <Square className="size-3.5" />
              {t("workspace.canvas.chrome.run.stop")}
            </button>
          ) : (
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium shadow-pill transition-all",
                canRun
                  ? "bg-foreground text-background hover:opacity-90"
                  : "cursor-not-allowed bg-surface text-muted-foreground ring-1 ring-border",
              )}
              data-testid="canvas-v2-run"
              disabled={!canRun}
              title={hasOperationNode ? undefined : t("workspace.canvas.chrome.run.noRunnableNodes")}
              type="button"
              onClick={handleRun}
            >
              <Play className="size-3.5 fill-current" />
              {latestJob ? t("workspace.canvas.chrome.run.rerun") : t("workspace.canvas.chrome.run.run")}
            </button>
          )
        ) : null}
        {!agentOpen ? (
          <button
            className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs shadow-pill ring-1 ring-border transition-colors hover:ring-border-strong"
            data-testid="canvas-v2-agent-reopen"
            type="button"
            onClick={() => setAgentOpen(true)}
          >
            <Bot className="size-3.5" />
            {t("workspace.canvas.chrome.breadcrumb.agent")}
          </button>
        ) : null}
      </div>
    </div>
  );
};
