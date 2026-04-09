import { useState } from "react";
import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../../_store";
import { ZoomIn, ZoomOut, Maximize2, Trash2, Undo2, Redo2, Bot, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Separator } from "@repo/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import { updatePipeline } from "@/services/pipelinesService";
import { useToastStore } from "@/hooks/useToastStore";
import { ResultAsync } from "neverthrow";

export const CanvasToolbar = () => {
  const { t } = useTranslation();
  const store = useHarnessCanvasStore();
  const selectedNodeId = useStore(store, (state) => state.selectedNodeId);
  const isAiAssistantOpen = useStore(store, (state) => state.isAiAssistantOpen);
  const canUndo = useStore(store, (state) => state.canUndo);
  const canRedo = useStore(store, (state) => state.canRedo);
  const fitView = useStore(store, (state) => state.fitView);
  const zoomIn = useStore(store, (state) => state.zoomIn);
  const zoomOut = useStore(store, (state) => state.zoomOut);
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const pipelineName = useStore(store, (state) => state.pipelineName);
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const removeNode = useStore(store, (state) => state.removeNode);
  const toggleAiAssistant = useStore(store, (state) => state.toggleAiAssistant);
  const undo = useStore(store, (state) => state.undo);
  const redo = useStore(store, (state) => state.redo);
  const setActiveJobId = useStore(store, (state) => state.setActiveJobId);
  const startTestRun = useStore(store, (state) => state.startTestRun);
  const isTestRunning = useStore(store, (state) => state.isTestRunning);

  const [isRunning, setIsRunning] = useState(false);

  const handleDeleteSelected = () => {
    if (selectedNodeId) {
      removeNode(selectedNodeId);
    }
  };

  const handleToggleAi = () => {
    toggleAiAssistant();
  };

  const handleZoomOut = zoomOut;
  const handleZoomIn = zoomIn;
  const handleFitView = () => fitView({ padding: 0.1 });
  const handleUndo = () => undo();
  const handleRedo = () => redo();

  const handleRunTest = async () => {
    if (isRunning || isTestRunning) return;

    if (!pipelineId) {
      useToastStore.getState().addToast({
        type: "error",
        title: t("canvas.runFailed"),
        description: t("canvas.saveFailed"),
      });
      return;
    }

    setIsRunning(true);
    startTestRun();

    const saveResult = await ResultAsync.fromPromise(
      updatePipeline({
        data: {
          id: pipelineId,
          patch: {
            name: pipelineName || "无标题 Pipeline",
            nodes: nodes as unknown[],
            edges: edges as unknown[],
            updatedAt: Date.now(),
          },
        },
      }),
      () => "save-failed" as const
    );

    if (saveResult.isErr()) {
      useToastStore.getState().addToast({
        type: "error",
        title: t("canvas.runFailed"),
        description: t("canvas.saveFailed"),
      });
      setIsRunning(false);
      return;
    }

    const runResult = await ResultAsync.fromPromise(
      fetch(`/api/pipelines/${pipelineId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).then(async (res) => {
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        return res.json() as Promise<{ jobId: string }>;
      }),
      (cause) => (cause instanceof Error ? cause.message : String(cause))
    );

    runResult.match(
      ({ jobId }) => {
        setActiveJobId(jobId);
        useToastStore.getState().addToast({
          type: "success",
          title: t("canvas.runCompleted"),
          description: `Job ${jobId} ${t("canvas.runSuccess")}`,
        });
      },
      (error) => {
        useToastStore.getState().addToast({
          type: "error",
          title: t("canvas.runFailed"),
          description: error,
        });
      }
    );

    setIsRunning(false);
  };

  const handleClickRun = () => void handleRunTest();

  return (
    <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
      <div className="flex items-center gap-0.5 rounded-xl border bg-background px-1.5 py-1 shadow-md">
        {/* Zoom controls */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button className="h-7 w-7" size="icon" variant="ghost" onClick={handleZoomOut} />
            }
          >
            <ZoomOut className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{t("canvas.zoomOut")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button className="h-7 w-7" size="icon" variant="ghost" onClick={handleZoomIn} />
            }
          >
            <ZoomIn className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{t("canvas.zoomIn")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button className="h-7 w-7" size="icon" variant="ghost" onClick={handleFitView} />
            }
          >
            <Maximize2 className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{t("canvas.fitView")}</TooltipContent>
        </Tooltip>

        <Separator className="mx-1 h-5" orientation="vertical" />

        {/* History controls */}
        <Button
          className="h-7 w-7"
          disabled={!canUndo}
          size="icon"
          title={t("canvas.undo")}
          variant="ghost"
          onClick={handleUndo}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          className="h-7 w-7"
          disabled={!canRedo}
          size="icon"
          title={t("canvas.redo")}
          variant="ghost"
          onClick={handleRedo}
        >
          <Redo2 className="h-4 w-4" />
        </Button>

        <Separator className="mx-1 h-5" orientation="vertical" />

        {/* Delete */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="h-7 w-7 text-destructive hover:bg-destructive/10 disabled:text-muted-foreground/30"
                disabled={!selectedNodeId}
                size="icon"
                variant="ghost"
                onClick={handleDeleteSelected}
              />
            }
          >
            <Trash2 className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{t("canvas.deleteNode")}</TooltipContent>
        </Tooltip>

        <Separator className="mx-1 h-5" orientation="vertical" />

        {/* AI Assistant */}
        <Button
          className="h-7 gap-1.5 px-2 text-xs"
          size="sm"
          variant={isAiAssistantOpen ? "default" : "ghost"}
          onClick={handleToggleAi}
        >
          <Bot className="h-3.5 w-3.5" />
          <span>AI</span>
        </Button>

        <Separator className="mx-1 h-5" orientation="vertical" />

        {/* Run Test */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="h-7 gap-1.5 px-2 text-xs text-green-600 hover:bg-green-50 hover:text-green-700 disabled:text-muted-foreground/30"
                disabled={isRunning || !pipelineId}
                size="sm"
                title="运行测试"
                variant="ghost"
                onClick={handleClickRun}
              />
            }
          >
            <Play className="h-3.5 w-3.5" />
            <span>{t("canvas.run")}</span>
          </TooltipTrigger>
          <TooltipContent>{t("canvas.run")}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
