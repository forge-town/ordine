import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../_store";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Undo2,
  Redo2,
  Bot,
  Play,
  AlignLeft,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Separator } from "@repo/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";

export const CanvasToolbar = () => {
  const { t } = useTranslation();
  const store = useHarnessCanvasStore();
  const selectedNodeId = useStore(store, (state) => state.selectedNodeId);
  const isAiAssistantOpen = useStore(store, (state) => state.isAiAssistantOpen);
  const canUndo = useStore(store, (state) => state.canUndo);
  const canRedo = useStore(store, (state) => state.canRedo);
  const handleFitView = useStore(store, (state) => state.handleFitView);
  const handleZoomIn = useStore(store, (state) => state.handleZoomIn);
  const handleZoomOut = useStore(store, (state) => state.handleZoomOut);
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const isRunning = useStore(store, (state) => state.isRunning);
  const handleDeleteSelected = useStore(store, (state) => state.handleDeleteSelected);
  const handleToggleAi = useStore(store, (state) => state.handleToggleAi);
  const handleUndo = useStore(store, (state) => state.handleUndo);
  const handleRedo = useStore(store, (state) => state.handleRedo);
  const handleFormatLayout = useStore(store, (state) => state.formatLayout);
  const handleRunTest = useStore(store, (state) => state.handleRunTest);

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
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                className="h-7 w-7"
                size="icon"
                variant="ghost"
                onClick={handleFormatLayout}
              />
            }
          >
            <AlignLeft className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{t("canvas.formatLayout")}</TooltipContent>
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
                onClick={handleRunTest}
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
