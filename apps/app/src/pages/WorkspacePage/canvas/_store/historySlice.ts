import type { StateCreator } from "zustand";
import { sortParentBeforeChildren, type CanvasEdge, type CanvasNode } from "./canvasTypes";

type GraphSnapshot = {
  edges: CanvasEdge[];
  nodes: CanvasNode[];
};

type HistoryGraphState = {
  edges: CanvasEdge[];
  nodes: CanvasNode[];
};

export type HistorySlice = {
  canRedo: boolean;
  canUndo: boolean;
  historyFuture: GraphSnapshot[];
  historyPast: GraphSnapshot[];
  clearHistory: () => void;
  recordHistory: (previous: GraphSnapshot) => void;
  redo: () => void;
  undo: () => void;
};

const MAX_HISTORY = 100;

const cloneSnapshot = (snapshot: GraphSnapshot): GraphSnapshot => ({
  edges: snapshot.edges.map((edge) => ({
    ...edge,
    data: edge.data ? { ...edge.data } : edge.data,
  })),
  nodes: sortParentBeforeChildren(
    snapshot.nodes.map((node) => ({ ...node, data: { ...node.data } })),
  ),
});

const hasGraphChanged = (a: GraphSnapshot, b: GraphSnapshot): boolean =>
  JSON.stringify(a) !== JSON.stringify(b);

export const createHistorySlice =
  <T extends HistoryGraphState & HistorySlice>(): StateCreator<T, [], [], HistorySlice> =>
  (set, get) => {
    const castHistoryState = (state: Partial<HistorySlice & HistoryGraphState>) =>
      state as unknown as Partial<T>;

    return {
      canRedo: false,
      canUndo: false,
      historyFuture: [],
      historyPast: [],
      clearHistory: () =>
        set(
          castHistoryState({
            canRedo: false,
            canUndo: false,
            historyFuture: [],
            historyPast: [],
          }),
        ),
      recordHistory: (previous) => {
        const current = { edges: get().edges, nodes: get().nodes };

        if (!hasGraphChanged(previous, current)) {
          return;
        }

        set((state) => {
          const historyPast = [...state.historyPast, cloneSnapshot(previous)].slice(-MAX_HISTORY);

          return castHistoryState({
            canRedo: false,
            canUndo: historyPast.length > 0,
            historyFuture: [],
            historyPast,
          });
        });
      },
      redo: () =>
        set((state) => {
          const next = state.historyFuture[0];
          if (!next) {
            return castHistoryState({});
          }

          const historyFuture = state.historyFuture.slice(1);
          const historyPast = [
            ...state.historyPast,
            cloneSnapshot({ edges: state.edges, nodes: state.nodes }),
          ].slice(-MAX_HISTORY);

          return castHistoryState({
            ...cloneSnapshot(next),
            canRedo: historyFuture.length > 0,
            canUndo: historyPast.length > 0,
            historyFuture,
            historyPast,
          });
        }),
      undo: () =>
        set((state) => {
          const previous = state.historyPast.at(-1);
          if (!previous) {
            return castHistoryState({});
          }

          const historyPast = state.historyPast.slice(0, -1);
          const historyFuture = [
            cloneSnapshot({ edges: state.edges, nodes: state.nodes }),
            ...state.historyFuture,
          ];

          return castHistoryState({
            ...cloneSnapshot(previous),
            canRedo: historyFuture.length > 0,
            canUndo: historyPast.length > 0,
            historyFuture,
            historyPast,
          });
        }),
    };
  };
