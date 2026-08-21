import { useStore } from "zustand";
import {
  AlignLeft,
  Hand,
  Lock,
  Minus,
  MoreHorizontal,
  MousePointer2,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  Unlock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@repo/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/ui/dropdown-menu";
import { cn } from "@repo/ui/lib/utils";
import { useCanvasPageStore } from "../_store";

export const CanvasToolbar = () => {
  const { t } = useTranslation();
  const store = useCanvasPageStore();
  const selectedNodeId = useStore(store, (state) => state.selectedNodeId);
  const canUndo = useStore(store, (state) => state.canUndo);
  const canRedo = useStore(store, (state) => state.canRedo);
  const handleFitView = useStore(store, (state) => state.handleFitView);
  const handleZoomIn = useStore(store, (state) => state.handleZoomIn);
  const handleZoomOut = useStore(store, (state) => state.handleZoomOut);
  const canvasTool = useStore(store, (state) => state.canvasTool);
  const viewportZoom = useStore(store, (state) => state.viewportZoom);
  const setCanvasTool = useStore(store, (state) => state.setCanvasTool);
  const isCanvasInteractive = useStore(store, (state) => state.isCanvasInteractive);
  const handleToggleCanvasInteractive = useStore(
    store,
    (state) => state.handleToggleCanvasInteractive,
  );
  const handleToggleQuickAdd = useStore(store, (state) => state.handleToggleQuickAdd);
  const handleDeleteSelected = useStore(store, (state) => state.handleDeleteSelected);
  const handleUndo = useStore(store, (state) => state.handleUndo);
  const handleRedo = useStore(store, (state) => state.handleRedo);
  const handleFormatLayout = useStore(store, (state) => state.formatLayout);
  const interactivityActionLabel = isCanvasInteractive
    ? t("canvas.disableInteractivity")
    : t("canvas.enableInteractivity");
  const InteractivityIcon = isCanvasInteractive ? Unlock : Lock;

  return (
    <div
      className="pointer-events-auto absolute bottom-4 right-4 z-20 flex items-center gap-0.5 rounded-full bg-surface p-1 shadow-pill ring-1 ring-border"
      data-testid="canvas-v2-toolbar"
    >
      <button
        className={cn(
          "rounded-full p-1.5 transition-colors",
          canvasTool === "select"
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent/60",
        )}
        data-testid="canvas-v2-tool-select"
        aria-pressed={canvasTool === "select"}
        title={t("canvas.selectTool")}
        type="button"
        onClick={() => setCanvasTool("select")}
      >
        <MousePointer2 className="size-3.5" />
      </button>
      <button
        className={cn(
          "rounded-full p-1.5 transition-colors",
          canvasTool === "hand"
            ? "bg-accent text-foreground"
            : "text-muted-foreground hover:bg-accent/60",
        )}
        data-testid="canvas-v2-tool-hand"
        aria-pressed={canvasTool === "hand"}
        title={t("canvas.handTool")}
        type="button"
        onClick={() => setCanvasTool("hand")}
      >
        <Hand className="size-3.5" />
      </button>
      <div className="mx-0.5 h-4 w-px bg-border-strong" />
      <button
        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        data-testid="canvas-v2-zoom-out"
        title={t("canvas.zoomOut")}
        type="button"
        onClick={handleZoomOut}
      >
        <Minus className="size-3.5" />
      </button>
      <button
        aria-label={t("canvas.fitView")}
        className="px-1 font-mono text-[11px] tabular-nums text-muted-foreground transition-colors hover:text-foreground"
        data-testid="canvas-v2-zoom-reset"
        title={t("canvas.fitView")}
        type="button"
        onClick={handleFitView}
      >
        {Math.round(viewportZoom * 100)}%
      </button>
      <button
        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        data-testid="canvas-v2-zoom-in"
        title={t("canvas.zoomIn")}
        type="button"
        onClick={handleZoomIn}
      >
        <Plus className="size-3.5" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              aria-label={t("canvas.floatingMenu.menu")}
              className="absolute bottom-0 right-[calc(100%+0.25rem)] size-8 rounded-full bg-surface shadow-pill ring-1 ring-border"
              data-testid="canvas-actions-menu"
              size="icon"
              title={t("canvas.floatingMenu.menu")}
              variant="ghost"
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" side="top" sideOffset={8}>
          <DropdownMenuItem onClick={handleToggleCanvasInteractive}>
            <InteractivityIcon className="size-4" />
            {interactivityActionLabel}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleFormatLayout}>
            <AlignLeft className="size-4" />
            {t("canvas.formatLayout")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={!canUndo} onClick={handleUndo}>
            <Undo2 className="size-4" />
            {t("canvas.undo")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!canRedo} onClick={handleRedo}>
            <Redo2 className="size-4" />
            {t("canvas.redo")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleToggleQuickAdd}>
            <Plus className="size-4" />
            {t("canvas.quickAdd.open")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!selectedNodeId} onClick={handleDeleteSelected}>
            <Trash2 className="size-4 text-destructive" />
            {t("canvas.deleteNode")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
