import type { HarnessCanvasStoreSlice } from "./harnessCanvasStore";

export interface ActionsSlice {
  exportCanvas: () => void;
  fitView: (options?: { padding?: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
}

export const createActionsSlice = (get: Parameters<HarnessCanvasStoreSlice>[1]): ActionsSlice => ({
  exportCanvas: () => {
    const state = get();
    const exportData = {
      name: state.pipelineName || "untitled",
      nodes: state.nodes,
      edges: state.edges,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.pipelineName || "pipeline"}.json`;
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  fitView: () => {},
  zoomIn: () => {},
  zoomOut: () => {},
});
