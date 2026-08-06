import { Hand, Minus, MousePointer2, Plus } from "lucide-react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import { cn } from "@repo/ui/lib/utils";
import { useCanvasStore } from "../_store/canvasStore";

export const CanvasToolbar = () => {
  const { t } = useTranslation();
  const canvasTool = useCanvasStore((state) => state.canvasTool);
  const setCanvasTool = useCanvasStore((state) => state.setCanvasTool);
  const { fitView, zoomIn, zoomOut } = useReactFlow();
  const { zoom } = useViewport();
  const handleSelectTool = () => setCanvasTool("select");
  const handlePanTool = () => setCanvasTool("hand");
  const handleZoomOut = () => void zoomOut({ duration: 150 });
  const handleResetView = () => void fitView({ duration: 200 });
  const handleZoomIn = () => void zoomIn({ duration: 150 });

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
        title={t("workspace.canvas.chrome.toolbar.select")}
        type="button"
        onClick={handleSelectTool}
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
        title={t("workspace.canvas.chrome.toolbar.pan")}
        type="button"
        onClick={handlePanTool}
      >
        <Hand className="size-3.5" />
      </button>
      <div className="mx-0.5 h-4 w-px bg-border-strong" />
      <button
        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        data-testid="canvas-v2-zoom-out"
        title={t("workspace.canvas.chrome.toolbar.zoomOut")}
        type="button"
        onClick={handleZoomOut}
      >
        <Minus className="size-3.5" />
      </button>
      <button
        className="px-1 font-mono text-[11px] tabular-nums text-muted-foreground transition-colors hover:text-foreground"
        data-testid="canvas-v2-zoom-reset"
        title={t("workspace.canvas.chrome.toolbar.resetView")}
        type="button"
        onClick={handleResetView}
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
        data-testid="canvas-v2-zoom-in"
        title={t("workspace.canvas.chrome.toolbar.zoomIn")}
        type="button"
        onClick={handleZoomIn}
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
};
