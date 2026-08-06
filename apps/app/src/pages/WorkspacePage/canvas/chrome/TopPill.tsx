import { useMemo, useState, type FocusEvent, type KeyboardEvent } from "react";
import { useOne, useUpdate } from "@refinedev/core";
import { ResultAsync } from "neverthrow";
import { ChevronRight, CornerUpLeft, Layers, Play, Square, Workflow } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Job } from "@repo/schemas";
import { cn } from "@repo/ui/lib/utils";
import { dataProvider, ResourceName } from "@/integrations/refine/dataProvider";
import { toastStore } from "@/store/toastStore";
import { toPipelineSnapshot, type CanvasEdge, type CanvasNode } from "../_store/canvasTypes";
import { useCanvasStore, useCanvasStoreApi } from "../_store/canvasStore";
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

const RUN_POLL_INTERVAL = 1000;
const TERMINAL_JOB_STATUSES = new Set<Job["status"]>([
  "cancelled",
  "done",
  "expired",
  "failed",
  "skipped",
]);

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
  const canvasStore = useCanvasStoreApi();
  const nodes = useCanvasStore((state) => state.nodes);
  const edges = useCanvasStore((state) => state.edges);
  const drillStack = useCanvasStore((state) => state.drillStack);
  const setDrillStack = useCanvasStore((state) => state.setDrillStack);
  const popDrillStack = useCanvasStore((state) => state.popDrillStack);
  const activeJobId = useCanvasStore((state) => state.activeJobId);
  const latestJob = useCanvasStore((state) => state.latestJob);
  const applyJobSnapshot = useCanvasStore((state) => state.applyJobSnapshot);
  const beginRun = useCanvasStore((state) => state.beginRun);
  const { mutate: updatePipeline } = useUpdate();

  const [renaming, setRenaming] = useState(false);
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [isStoppingRun, setIsStoppingRun] = useState(false);
  const graphJson = useMemo(() => stableGraphJson(nodes, edges), [edges, nodes]);
  const [savedGraphJson, setSavedGraphJson] = useState(graphJson);

  useOne<Job>({
    resource: ResourceName.jobs,
    id: activeJobId ?? "",
    queryOptions: {
      enabled: activeJobId !== null,
      queryFn: async () => {
        const response = await dataProvider.getOne!<Job>({
          id: activeJobId ?? "",
          resource: ResourceName.jobs,
        });
        if (canvasStore.getState().activeJobId === response.data.id) {
          applyJobSnapshot(response.data);
        }

        return response;
      },
      refetchInterval: (query) => {
        const status = (query.state.data?.data as Job | undefined)?.status;

        return status && TERMINAL_JOB_STATUSES.has(status) ? false : RUN_POLL_INTERVAL;
      },
    },
  });

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

  const handlePersistGraph = () => {
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
          toastStore.getState().addToast({
            title: t("workspace.canvas.chrome.version.saveSuccess", {
              version: pipeline.version,
            }),
            type: "success",
          });
        },
      },
    );
  };

  const handleCommitRename = (value: string) => {
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

  const handleStop = () => {
    if (!activeJobId) {
      return;
    }

    const jobId = activeJobId;
    setIsStoppingRun(true);
    void ResultAsync.fromPromise(
      dataProvider.custom!({
        method: "post",
        payload: { jobId },
        url: "pipelines/cancel",
      }),
      () => t("workspace.canvas.chrome.run.stopFailed"),
    )
      .andThen(() =>
        ResultAsync.fromPromise(
          dataProvider.getOne!<Job>({ id: jobId, resource: ResourceName.jobs }),
          () => t("workspace.canvas.chrome.run.stopFailed"),
        ),
      )
      .match(
        (response) => {
          if (canvasStore.getState().activeJobId === jobId) {
            applyJobSnapshot(response.data);
          }
          setIsStoppingRun(false);
          toastStore.getState().addToast({
            title: t("workspace.canvas.chrome.run.stopped"),
            type: "success",
          });
        },
        (error) => {
          setIsStoppingRun(false);
          toastStore.getState().addToast({
            title: error,
            type: "error",
          });
        },
      );
  };

  const handleDrillOut = () => popDrillStack();

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
            const handleRenameBlur = (event: FocusEvent<HTMLInputElement>) =>
              handleCommitRename(event.target.value);
            const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
              if (event.key === "Enter") {
                handleCommitRename(event.currentTarget.value);
              }
              if (event.key === "Escape") {
                setRenaming(false);
              }
            };
            const handleCrumbClick = () => {
              if (index === 0 && isLast) {
                setRenaming(true);

                return;
              }
              setDrillStack(drillStack.slice(0, index));
            };
            const handleCrumbDoubleClick = () => {
              if (index === 0) {
                setRenaming(true);
              }
            };

            if (index === 0 && renaming) {
              return (
                <input
                  key="rename"
                  autoFocus
                  className="w-44 rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-border-strong"
                  data-testid="canvas-v2-rename-input"
                  defaultValue={crumb.label}
                  onBlur={handleRenameBlur}
                  onKeyDown={handleRenameKeyDown}
                />
              );
            }

            return (
              <span key={crumb.id} className="flex min-w-0 items-center gap-1">
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
                  onClick={handleCrumbClick}
                  onDoubleClick={handleCrumbDoubleClick}
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
              version={pipeline.version}
              onSave={handlePersistGraph}
            />
          ) : null}
        </div>
        {atRoot ? null : (
          <button
            className="flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-xs shadow-pill ring-1 ring-border transition-colors hover:ring-border-strong"
            data-testid="canvas-v2-drill-out"
            type="button"
            onClick={handleDrillOut}
          >
            <CornerUpLeft className="size-3.5" />
            {t("workspace.canvas.chrome.breadcrumb.drillOut")}
          </button>
        )}
      </div>

      <div className="pointer-events-auto flex shrink-0 items-center gap-2">
        {atRoot ? <StateLegend /> : null}
        {atRoot ? (
          running ? (
            <button
              className="flex items-center gap-1.5 rounded-full bg-surface px-3.5 py-1.5 text-xs font-medium text-foreground shadow-pill ring-1 ring-border transition-colors hover:ring-border-strong disabled:cursor-wait disabled:opacity-70"
              data-testid="canvas-v2-stop"
              disabled={isStoppingRun}
              type="button"
              onClick={handleStop}
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
              title={
                hasOperationNode ? undefined : t("workspace.canvas.chrome.run.noRunnableNodes")
              }
              type="button"
              onClick={handleRun}
            >
              <Play className="size-3.5 fill-current" />
              {latestJob
                ? t("workspace.canvas.chrome.run.rerun")
                : t("workspace.canvas.chrome.run.run")}
            </button>
          )
        ) : null}
      </div>
    </div>
  );
};
