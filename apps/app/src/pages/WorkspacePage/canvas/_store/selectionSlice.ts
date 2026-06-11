import type { StateCreator } from "zustand";
import type { WorkspaceCanvasRef } from "@repo/schemas";
import type { CanvasEdge, CanvasNode } from "./canvasTypes";

export type SelectionMode = "add" | "replace" | "toggle";

type SelectionGraphState = {
  drillStack: string[];
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

const refId = (drillStack: readonly string[], baseId: string): string =>
  drillStack.length > 0 ? [...drillStack, baseId].join("/") : baseId;

const drillLabelPrefix = (
  drillStack: readonly string[],
  nodes: readonly CanvasNode[],
): string => {
  if (drillStack.length === 0) {
    return "";
  }
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const labels = drillStack.map((id) => nodeById.get(id)?.data.label ?? id);

  return `${labels.join(" / ")} / `;
};

const toSelectedRefs = (
  selectedIds: readonly string[],
  nodes: readonly CanvasNode[],
  edges: readonly CanvasEdge[],
  drillStack: readonly string[],
): WorkspaceCanvasRef[] => {
  const prefix = drillLabelPrefix(drillStack, nodes);
  const path = [...drillStack];
  const nodeRefs = nodes
    .filter((node) => selectedIds.includes(node.id))
    .map(
      (node): WorkspaceCanvasRef => ({
        baseId: node.id,
        id: refId(drillStack, node.id),
        kind: node.type ?? "node",
        label: `${prefix}${node.data.label}`,
        path,
        type: "node",
      }),
    );
  const edgeRefs = edges
    .filter((edge) => selectedIds.includes(edge.id))
    .map(
      (edge): WorkspaceCanvasRef => ({
        baseId: edge.id,
        id: refId(drillStack, edge.id),
        kind: "semantic",
        label: `${prefix}${edge.data?.label || `${edge.source} → ${edge.target}`}`,
        path,
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
        const childEdges = state.nodes.flatMap((node) =>
          node.type === "compound"
            ? ((node.data as { childEdges?: CanvasEdge[] }).childEdges ?? [])
            : [],
        );

        return toSelectedRefs(
          state.selectedIds,
          state.nodes,
          [...state.edges, ...childEdges],
          state.drillStack,
        );
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
