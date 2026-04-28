import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useHarnessCanvasStore } from "../_store";
import { formatZoomPercent } from "../utils/canvasViewport";

export const CanvasStatusBar = () => {
  const { t } = useTranslation();
  const store = useHarnessCanvasStore();
  const nodes = useStore(store, (state) => state.nodes);
  const edges = useStore(store, (state) => state.edges);
  const selectedNodeId = useStore(store, (state) => state.selectedNodeId);
  const viewportZoom = useStore(store, (state) => state.viewportZoom);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 -translate-x-1/2">
      <div className="flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-border bg-background/90 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
        <span className="whitespace-nowrap">
          {t("canvas.status.nodeCount", { count: nodes.length })}
        </span>
        <span className="text-border">|</span>
        <span className="whitespace-nowrap">
          {t("canvas.status.edgeCount", { count: edges.length })}
        </span>
        <span className="text-border">|</span>
        <span className="whitespace-nowrap">
          {t("canvas.status.zoom", { zoom: formatZoomPercent(viewportZoom) })}
        </span>
        <span className="text-border">|</span>
        <span className="max-w-56 truncate">
          {selectedNode
            ? t("canvas.status.selectedNode", { label: selectedNode.data.label })
            : t("canvas.status.noSelection")}
        </span>
      </div>
    </div>
  );
};
