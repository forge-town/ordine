import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../_store";
import { ZoomIn, ZoomOut, Maximize2, Trash2, Download, Undo2, Redo2, Bot } from "lucide-react";
import { Button } from "@repo/ui/button";
import { Separator } from "@repo/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/ui/tooltip";

export const CanvasToolbar = () => {
  const store = useHarnessCanvasStore();
  const selectedNodeId = useStore(store, (state) => state.selectedNodeId);
  const isAiAssistantOpen = useStore(store, (state) => state.isAiAssistantOpen);
  const canUndo = useStore(store, (state) => state.canUndo);
  const canRedo = useStore(store, (state) => state.canRedo);
  const fitView = useStore(store, (state) => state.fitView);
  const zoomIn = useStore(store, (state) => state.zoomIn);
  const zoomOut = useStore(store, (state) => state.zoomOut);
  const exportCanvas = useStore(store, (state) => state.exportCanvas);

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
  const handleExportCanvas = exportCanvas;

  return (
    <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
      <div className="flex items-center gap-0.5 rounded-xl border bg-background px-1.5 py-1 shadow-md">
        {/* Zoom controls */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} />
            }
          >
            <ZoomOut className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>缩小</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} />
            }
          >
            <ZoomIn className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>放大</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleFitView} />
            }
          >
            <Maximize2 className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>适合视图</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* History controls */}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={!canUndo}
          onClick={handleUndo}
          title="撤销"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          disabled={!canRedo}
          onClick={handleRedo}
          title="重做"
        >
          <Redo2 className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* Delete */}
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:bg-destructive/10 disabled:text-muted-foreground/30"
                onClick={handleDeleteSelected}
                disabled={!selectedNodeId}
              />
            }
          >
            <Trash2 className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>删除选中</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleExportCanvas}
              />
            }
          >
            <Download className="h-4 w-4" />
          </TooltipTrigger>
          <TooltipContent>导出</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 h-5" />

        {/* AI Assistant */}
        <Button
          variant={isAiAssistantOpen ? "default" : "ghost"}
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={handleToggleAi}
        >
          <Bot className="h-3.5 w-3.5" />
          <span>AI</span>
        </Button>
      </div>
    </div>
  );
};
