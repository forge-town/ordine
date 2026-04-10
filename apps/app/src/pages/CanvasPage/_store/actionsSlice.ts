import type { PipelineEdge, PipelineNode } from "./canvasSlice";
import type { HarnessCanvasStoreSlice } from "./harnessCanvasStore";

export interface ActionsSlice {
  exportCanvas: () => void;
  importCanvas: (data: { nodes: PipelineNode[]; edges: PipelineEdge[] }) => void;
  fitView: (options?: { padding?: number }) => void;
  handleZoomIn: () => void;
  handleZoomOut: () => void;

  // Cross-slice semantic actions
  focusNode: (nodeId: string) => void;
  focusEdge: (edgeId: string) => void;
  clearSelection: () => void;
  handleDeleteSelected: () => void;
}

export const createActionsSlice = (
  set: Parameters<HarnessCanvasStoreSlice>[0],
  get: Parameters<HarnessCanvasStoreSlice>[1]
): ActionsSlice => ({
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
  importCanvas: ({ nodes, edges }) => {
    set({ nodes, edges, selectedNodeId: null, selectedEdgeId: null });
  },
  fitView: () => {},
  handleZoomIn: () => {},
  handleZoomOut: () => {},

  focusNode: (nodeId) => {
    set({
      selectedNodeId: nodeId,
      selectedEdgeId: null,
      contextMenu: null,
      connectionMenu: null,
      nodeContextMenu: null,
      connectStart: null,
    });
  },

  focusEdge: (edgeId) => {
    set({
      selectedEdgeId: edgeId,
      selectedNodeId: null,
      contextMenu: null,
      connectionMenu: null,
      nodeContextMenu: null,
      connectStart: null,
    });
  },

  clearSelection: () => {
    set({
      selectedNodeId: null,
      selectedEdgeId: null,
      contextMenu: null,
      connectionMenu: null,
      nodeContextMenu: null,
      connectStart: null,
    });
  },

  handleDeleteSelected: () => {
    const { selectedNodeId } = get();
    if (selectedNodeId) {
      get().removeNode(selectedNodeId);
    }
  },
});
