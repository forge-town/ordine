import { useStore } from "zustand";
import { useCanvasPageStore } from "../_store";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Trash2,
  Undo2,
  Redo2,
  Play,
  AlignLeft,
  Plus,
  Bot,
  Lock,
  Unlock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import { Separator } from "@repo/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";

export const CanvasToolbar = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const selectedNodeId = useStore(store, (state) => state.selectedNodeId);
  const canUndo = useStore(store, (state) => state.canUndo);
  const canRedo = useStore(store, (state) => state.canRedo);
  const handleFitView = useStore(store, (state) => state.handleFitView);
  const handleZoomIn = useStore(store, (state) => state.handleZoomIn);
  const handleZoomOut = useStore(store, (state) => state.handleZoomOut);
  const isCanvasInteractive = useStore(store, (state) => state.isCanvasInteractive);
  const handleToggleCanvasInteractive = useStore(
    store,
    (state) => state.handleToggleCanvasInteractive,
  );
  const isQuickAddOpen = useStore(store, (state) => state.isQuickAddOpen);
  const handleToggleQuickAdd = useStore(store, (state) => state.handleToggleQuickAdd);
  const pipelineId = useStore(store, (state) => state.pipelineId);
  const isRunning = useStore(store, (state) => state.isRunning);
  const handleDeleteSelected = useStore(store, (state) => state.handleDeleteSelected);
  const handleUndo = useStore(store, (state) => state.handleUndo);
  const handleRedo = useStore(store, (state) => state.handleRedo);
  const handleFormatLayout = useStore(store, (state) => state.formatLayout);
  const handleRunTest = useStore(store, (state) => state.handleRunTest);
  const handleToggleAgentPanel = useStore(store, (state) => state.toggleAgentPanel);
  const agentPanelIsOpen = useStore(store, (state) => state.agentPanel.isOpen);
  const interactivityActionLabel = isCanvasInteractive
    ? t("canvas.disableInteractivity")
    : t("canvas.enableInteractivity");
  const InteractivityIcon = isCanvasInteractive ? Unlock : Lock;

  return (
    <div className="pointer-events-auto w-max max-w-full" data-testid="canvas-toolbar">
      <div className="flex h-10 w-max items-center gap-0.5 rounded-full border bg-background px-1.5 py-1 shadow-md max-[420px]:gap-0 max-[420px]:px-1">
        {/* Zoom controls */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t("canvas.zoomOut")}
                className="h-7 w-7"
                size="icon"
                title={t("canvas.zoomOut")}
                variant="ghost"
                onClick={handleZoomOut}
              />
            }
          >
            <ZoomOut className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{t("canvas.zoomOut")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t("canvas.zoomIn")}
                className="h-7 w-7"
                size="icon"
                title={t("canvas.zoomIn")}
                variant="ghost"
                onClick={handleZoomIn}
              />
            }
          >
            <ZoomIn className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{t("canvas.zoomIn")}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t("canvas.fitView")}
                className="h-7 w-7"
                size="icon"
                title={t("canvas.fitView")}
                variant="ghost"
                onClick={handleFitView}
              />
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
                aria-label={interactivityActionLabel}
                aria-pressed={isCanvasInteractive}
                className="h-7 w-7"
                size="icon"
                title={interactivityActionLabel}
                variant="ghost"
                onClick={handleToggleCanvasInteractive}
              />
            }
          >
            <InteractivityIcon className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{interactivityActionLabel}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t("canvas.formatLayout")}
                className="h-7 w-7"
                size="icon"
                title={t("canvas.formatLayout")}
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

        {/* Quick add */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t("canvas.quickAdd.open")}
                aria-pressed={isQuickAddOpen}
                className="h-7 w-7 text-primary hover:bg-primary/10"
                size="icon"
                title={t("canvas.quickAdd.open")}
                variant="ghost"
                onClick={handleToggleQuickAdd}
              />
            }
          >
            <Plus className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{t("canvas.quickAdd.open")}</TooltipContent>
        </Tooltip>

        {/* AI Assistant */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t("canvas.agentPanel.toggle")}
                aria-pressed={agentPanelIsOpen}
                className="h-7 w-7 text-primary hover:bg-primary/10"
                size="icon"
                title={t("canvas.agentPanel.toggle")}
                variant="ghost"
                onClick={handleToggleAgentPanel}
              />
            }
          >
            <Bot className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>{t("canvas.agentPanel.toggle")}</TooltipContent>
        </Tooltip>

        <Separator className="mx-1 h-5" orientation="vertical" />

        {/* Delete */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t("canvas.deleteNode")}
                className="h-7 w-7 text-destructive hover:bg-destructive/10 disabled:text-muted-foreground/30"
                disabled={!selectedNodeId}
                size="icon"
                title={t("canvas.deleteNode")}
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

        {/* Run Test */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label={t("canvas.runTest")}
                className="h-7 gap-1.5 px-2 text-xs text-green-600 hover:bg-green-50 hover:text-green-700 disabled:text-muted-foreground/30 max-[420px]:w-7 max-[420px]:gap-0 max-[420px]:px-0"
                disabled={isRunning || !pipelineId}
                size="sm"
                title={t("canvas.runTest")}
                variant="ghost"
                onClick={handleRunTest}
              />
            }
          >
            <Play className="h-3.5 w-3.5" />
            <span className="max-[420px]:hidden">{t("canvas.run")}</span>
          </TooltipTrigger>
          <TooltipContent>{t("canvas.runTest")}</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
