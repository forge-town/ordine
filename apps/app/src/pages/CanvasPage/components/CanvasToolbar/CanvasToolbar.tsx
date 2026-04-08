import { useState } from "react";
import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../../_store";
import { ZoomIn, ZoomOut, Maximize2, Trash2, Undo2, Redo2, Bot, Play } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Separator } from "@repo/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";
import { useCreate, useUpdate } from "@refinedev/core";
import { ResourceName } from "@/integrations/refine/dataProvider";

const MASTRA_BASE = "http://localhost:4111";
const VALIDATOR_AGENT_ID = "harnessValidatorAgent";
import { useToastStore } from "@/hooks/useToastStore";

export const CanvasToolbar = () => {
  const store = useHarnessCanvasStore();
  const selectedNodeId = useStore(store, (state) => state.selectedNodeId);
  const isAiAssistantOpen = useStore(store, (state) => state.isAiAssistantOpen);
  const canUndo = useStore(store, (state) => state.canUndo);
  const canRedo = useStore(store, (state) => state.canRedo);
  const fitView = useStore(store, (state) => state.fitView);
  const zoomIn = useStore(store, (state) => state.zoomIn);
  const zoomOut = useStore(store, (state) => state.zoomOut);
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);

  const [isRunning, setIsRunning] = useState(false);

  const { mutate: createJobMutation } = useCreate();
  const { mutate: updateJobMutation } = useUpdate();

  const handleDeleteSelected = () => {
    if (selectedNodeId) {
      store.getState().removeNode(selectedNodeId);
    }
  };

  const handleToggleAi = () => {
    store.getState().toggleAiAssistant();
  };

  const handleZoomOut = zoomOut;
  const handleZoomIn = zoomIn;
  const handleFitView = () => fitView({ padding: 0.1 });
  const handleUndo = () => store.getState().undo();
  const handleRedo = () => store.getState().redo();

  const handleRunTest = () => {
    if (isRunning) return;
    setIsRunning(true);

    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = Date.now();

    const snapshot = JSON.stringify({
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        label: (n.data as { label?: string }).label ?? n.id,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
      })),
    });

    const finishRun = () => setIsRunning(false);

    const onValidateSuccess = (output: string) => {
      updateJobMutation(
        {
          resource: ResourceName.jobs,
          id: jobId,
          values: {
            status: "success",
            finishedAt: Date.now(),
            result: { output, summary: "验证完成" },
          },
        },
        {
          onSuccess: () => {
            useToastStore.getState().addToast({
              type: "success",
              title: "测试运行完成",
              description: "Pipeline 验证已完成",
            });
            finishRun();
          },
          onError: () => {
            useToastStore.getState().addToast({
              type: "error",
              title: "运行失败",
              description: "Pipeline 验证结果保存失败",
            });
            finishRun();
          },
        }
      );
    };

    const onValidateError = () => {
      updateJobMutation(
        {
          resource: ResourceName.jobs,
          id: jobId,
          values: {
            status: "failed",
            finishedAt: Date.now(),
            error: "运行失败",
          },
        },
        { onSuccess: finishRun, onError: finishRun }
      );
      useToastStore.getState().addToast({
        type: "error",
        title: "运行失败",
        description: "Pipeline 验证失败，请重试",
      });
    };

    const runValidation = () => {
      fetch(`${MASTRA_BASE}/api/agents/${VALIDATOR_AGENT_ID}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `请验证以下线束设计的连接完整性：\n${snapshot}`,
            },
          ],
        }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json() as Promise<{ text?: string; content?: string }>;
        })
        .then((data) => onValidateSuccess(data.text ?? data.content ?? ""))
        .catch(onValidateError);
    };

    createJobMutation(
      {
        resource: ResourceName.jobs,
        values: {
          id: jobId,
          title: "Pipeline 测试运行",
          type: "pipeline_run",
          pipelineId,
          workId: null,
          projectId: null,
          logs: [],
          result: null,
          error: null,
          status: "running",
          startedAt,
          finishedAt: null,
        },
      },
      {
        onSuccess: runValidation,
        onError: () => {
          useToastStore.getState().addToast({
            type: "error",
            title: "触发失败",
            description: "无法创建测试运行，请重试",
          });
          finishRun();
        },
      }
    );
  };

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
          <TooltipContent>缩小</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button className="h-7 w-7" size="icon" variant="ghost" onClick={handleZoomIn} />
            }
          >
            <ZoomIn className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>放大</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button className="h-7 w-7" size="icon" variant="ghost" onClick={handleFitView} />
            }
          >
            <Maximize2 className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>适合视图</TooltipContent>
        </Tooltip>

        <Separator className="mx-1 h-5" orientation="vertical" />

        {/* History controls */}
        <Button
          className="h-7 w-7"
          disabled={!canUndo}
          size="icon"
          title="撤销"
          variant="ghost"
          onClick={handleUndo}
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          className="h-7 w-7"
          disabled={!canRedo}
          size="icon"
          title="重做"
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
          <TooltipContent>删除选中</TooltipContent>
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
                disabled={isRunning}
                size="sm"
                title="运行测试"
                variant="ghost"
                onClick={handleRunTest}
              />
            }
          >
            <Play className="h-3.5 w-3.5" />
            <span>运行</span>
          </TooltipTrigger>
          <TooltipContent>运行测试</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
