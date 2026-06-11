import type { StateCreator } from "zustand";
import type { WorkspaceCanvasRef } from "../../_store/workspaceStore";
import type { CanvasEdge, CanvasNode } from "./canvasTypes";

export type SelectionMode = "add" | "replace" | "toggle";

type SelectionGraphState = {
  edges: CanvasEdge[];
  nodes: CanvasNode[];
};

export type SelectionSlice = {
  clearSelection: () => void;
  getSelectedRefs: () => WorkspaceCanvasRef[];
  selectEdge: (edgeId: string | null, mode?: SelectionMode) => void;
  selectNode: (nodeId: string | null, mode?: SelectionMode) => void;
  selectedEdgeId: string | null;
  selectedIds: string[];
  selectedNodeId: string | null;
  setSelectedIds: (ids: string[]) => void;
};

const getNextSelectedIds = (
  currentIds: readonly string[],
  id: string | null,
  mode: SelectionMode,
): string[] => {
  if (!id) {
    return [];
  }
  if (mode === "replace") {
    return [id];
  }
  if (mode === "add") {
    return currentIds.includes(id) ? [...currentIds] : [...currentIds, id];
  }

  return currentIds.includes(id)
    ? currentIds.filter((selectedId) => selectedId !== id)
    : [...currentIds, id];
};

const toSelectedRefs = (
  selectedIds: readonly string[],
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
): WorkspaceCanvasRef[] => {
  const nodeRefs = nodes
    .filter((node) => selectedIds.includes(node.id))
    .map(
      (node): WorkspaceCanvasRef => ({
        id: node.id,
        label: node.data.label,
        type: "node",
      }),
    );
  const edgeRefs = edges
    .filter((edge) => selectedIds.includes(edge.id))
    .map(
      (edge): WorkspaceCanvasRef => ({
        id: edge.id,
        label: edge.data?.label || `${edge.source} -> ${edge.target}`,
        type: "edge",
      }),
    );

  return [...nodeRefs, ...edgeRefs];
};

export const createSelectionSlice =
  <T extends SelectionGraphState & SelectionSlice>(): StateCreator<T, [], [], SelectionSlice> =>
  (set, get) => {
    const castSelectionState = (state: Partial<SelectionSlice>) => state as unknown as Partial<T>;

    return {
      selectedEdgeId: null,
      selectedIds: [],
      selectedNodeId: null,
      clearSelection: () =>
        set(
          castSelectionState({
            selectedEdgeId: null,
            selectedIds: [],
            selectedNodeId: null,
          }),
        ),
      getSelectedRefs: () => {
        const state = get();

        return toSelectedRefs(state.selectedIds, state.nodes, state.edges);
      },
      selectEdge: (edgeId, mode = "replace") =>
        set(
          (state) =>
            ({
              selectedEdgeId: edgeId,
              selectedIds: getNextSelectedIds(state.selectedIds, edgeId, mode),
              selectedNodeId: mode === "replace" ? null : state.selectedNodeId,
            }) as unknown as Partial<T>,
        ),
      selectNode: (nodeId, mode = "replace") =>
        set(
          (state) =>
            ({
              selectedEdgeId: mode === "replace" ? null : state.selectedEdgeId,
              selectedIds: getNextSelectedIds(state.selectedIds, nodeId, mode),
              selectedNodeId: nodeId,
            }) as unknown as Partial<T>,
        ),
      setSelectedIds: (ids) =>
        set(
          castSelectionState({
            selectedEdgeId: null,
            selectedIds: [...ids],
            selectedNodeId: null,
          }),
        ),
    };
  };
