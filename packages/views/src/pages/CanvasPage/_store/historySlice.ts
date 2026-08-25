/**
 * History Slice — Hybrid Command + Patch undo/redo
 *
 * Architecture (per the design doc):
 *   HistoryEntry = { command: CommandMeta, patches: Patch[], inversePatches: Patch[] }
 *
 * - `patches`        → how to re-apply (redo)
 * - `inversePatches` → how to revert (undo)
 * - `command`        → WHY it changed (semantic label, used in logs / future AI replay)
 *
 * Callers never touch this slice directly.
 * Instead, canvas mutations call `recordCommand(command, fn)` which:
 *   1. Runs `fn` on a draft via immer `produceWithPatches`
 *   2. Pushes the resulting entry onto the history stack
 *   3. Clears the redo stack
 */

import { produceWithPatches, applyPatches, enablePatches, type Patch } from "immer";
import { ResultAsync } from "neverthrow";
import type { PipelineGraphSnapshot } from "@repo/schemas";
import type { CanvasPageStoreSlice } from "./canvasPageStore";
import { sortParentBeforeChildren, type PipelineNode, type PipelineEdge } from "./canvasSlice";

// Enable immer's patch plugin (must be called once, at module level)
enablePatches();

// ─── Command metadata ─────────────────────────────────────────────────────────

export type CommandType =
  | "ADD_NODE"
  | "REMOVE_NODE"
  | "MOVE_NODE"
  | "UPDATE_NODE_DATA"
  | "DUPLICATE_NODE"
  | "ADD_EDGE"
  | "REMOVE_EDGE"
  | "ADD_NODE_WITH_EDGE"
  | "ADD_TO_COMPOUND"
  | "REMOVE_FROM_COMPOUND"
  | "GROUP_NODES"
  | "UNGROUP_COMPOUND"
  | "CLEAR_CANVAS"
  | "APPLY_AGENT_PROPOSAL"
  | "APPLY_AGENT_CHANGESET";

export interface CommandMeta {
  type: CommandType;
  /** Human-readable label for history panel / logs */
  label: string;
  /** Optional payload for logging / AI replay */
  payload?: Record<string, unknown>;
}

// ─── Patch types (re-exported from immer) ────────────────────────────────────
// Patch is imported above and re-exported below via the HistoryEntry interface.

// ─── History entry ────────────────────────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  command: CommandMeta;
  patches: Patch[];
  inversePatches: Patch[];
  remote?: {
    changeSetId: string;
    version: number;
  };
}

export type AgentHistoryGateway = {
  revert: (
    changeSetId: string,
    expectedVersion: number,
  ) => Promise<{ snapshot: PipelineGraphSnapshot; newVersion: number }>;
  redo: (
    changeSetId: string,
    expectedVersion: number,
  ) => Promise<{ snapshot: PipelineGraphSnapshot; newVersion: number }>;
  reportError: (message: string) => void;
};

let agentHistoryGateway: AgentHistoryGateway | null = null;

export const setAgentHistoryGateway = (gateway: AgentHistoryGateway | null) => {
  agentHistoryGateway = gateway;
};

// ─── The canvas sub-state that history operates on ───────────────────────────

export interface CanvasHistoryState {
  nodes: PipelineNode[];
  edges: PipelineEdge[];
}

// ─── Slice interface ──────────────────────────────────────────────────────────

export interface HistorySlice {
  /** Past entries – index 0 is the oldest */
  _history: HistoryEntry[];
  /** Entries cleared by undo, available for redo */
  _future: HistoryEntry[];
  /** Maximum number of history entries to keep */
  _maxHistory: number;

  canUndo: boolean;
  canRedo: boolean;

  /**
   * Record a canvas mutation as a history entry.
   *
   * @param command  – semantic metadata  (type + label + optional payload)
   * @param mutate   – a function that receives the current {nodes, edges}
   *                   and mutates it **as an Immer draft**
   *
   * Returns the next state so the caller can merge it with `set(...)`.
   */
  recordCommand: (command: CommandMeta, mutate: (draft: CanvasHistoryState) => void) => void;

  /** Record a mutation that React Flow already applied to the live canvas state. */
  recordStateTransition: (command: CommandMeta, previous: CanvasHistoryState) => void;

  recordAgentChangeSet: (
    changeSetId: string,
    previousVersion: number,
    newVersion: number,
    previous: PipelineGraphSnapshot,
    next: PipelineGraphSnapshot,
  ) => void;

  handleUndo: () => void;
  handleRedo: () => void;
  clearHistory: () => void;
}

const sortNodesAfterHistoryPatch = (nodes: PipelineNode[]): PipelineNode[] => {
  const sortedNodes = [...nodes];
  sortParentBeforeChildren(sortedNodes);

  return sortedNodes;
};

// ─── Factory ──────────────────────────────────────────────────────────────────

export const createHistorySlice = (
  set: Parameters<CanvasPageStoreSlice>[0],
  get: Parameters<CanvasPageStoreSlice>[1],
): HistorySlice => ({
  _history: [],
  _future: [],
  _maxHistory: 100,

  canUndo: false,
  canRedo: false,

  recordCommand(command, mutate) {
    const state = get();
    if (state.isAgentStructureLocked) return;
    const current: CanvasHistoryState = {
      nodes: state.nodes,
      edges: state.edges,
    };

    const [next, patches, inversePatches] = produceWithPatches(current, (draft) => {
      mutate(draft);
    });

    // Nothing changed — skip recording
    if (patches.length === 0) return;

    const entry: HistoryEntry = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      command,
      patches,
      inversePatches,
    };

    set((s) => {
      const history = [...s._history.slice(-(s._maxHistory - 1)), entry];

      return {
        nodes: next.nodes,
        edges: next.edges,
        _history: history,
        _future: [], // clear redo stack on new action
        canUndo: history.length > 0,
        canRedo: false,
      };
    });
  },

  recordStateTransition(command, previous) {
    const state = get();
    if (state.isAgentStructureLocked) return;
    const current: CanvasHistoryState = {
      nodes: state.nodes,
      edges: state.edges,
    };
    const [, patches, inversePatches] = produceWithPatches(previous, (draft) => {
      draft.nodes = current.nodes;
      draft.edges = current.edges;
    });

    if (patches.length === 0) return;

    const entry: HistoryEntry = {
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      command,
      patches,
      inversePatches,
    };

    set((s) => {
      const history = [...s._history.slice(-(s._maxHistory - 1)), entry];

      return {
        _history: history,
        _future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  recordAgentChangeSet(changeSetId, previousVersion, newVersion, previous, next) {
    const [, patches, inversePatches] = produceWithPatches(
      { nodes: previous.nodes as PipelineNode[], edges: previous.edges as PipelineEdge[] },
      (draft) => {
        draft.nodes = next.nodes as PipelineNode[];
        draft.edges = next.edges as PipelineEdge[];
      },
    );
    const entry: HistoryEntry = {
      id: `hist-agent-${changeSetId}`,
      command: {
        type: "APPLY_AGENT_CHANGESET",
        label: "Apply Agent Change Set",
        payload: { changeSetId, previousVersion, newVersion },
      },
      patches,
      inversePatches,
      remote: { changeSetId, version: newVersion },
    };
    set((state) => {
      const history = [...state._history.slice(-(state._maxHistory - 1)), entry];

      return {
        _history: history,
        _future: [],
        canUndo: true,
        canRedo: false,
      };
    });
  },

  handleUndo() {
    const { _history, _future } = get();
    if (_history.length === 0) return;

    const entry = _history.at(-1);
    if (!entry) return;
    if (entry.remote) {
      if (!agentHistoryGateway) return;
      void ResultAsync.fromPromise(
        agentHistoryGateway.revert(entry.remote.changeSetId, entry.remote.version),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      ).match(
        ({ snapshot, newVersion }) => {
          const history = get()._history.slice(0, -1);
          const futureEntry = { ...entry, remote: { ...entry.remote!, version: newVersion } };
          const snapshotState = toCanvasHistoryState(snapshot);
          set({
            ...snapshotState,
            pipelineVersion: newVersion,
            _history: history,
            _future: [futureEntry, ...get()._future],
            canUndo: history.length > 0,
            canRedo: true,
          });
        },
        (error) => agentHistoryGateway?.reportError(error.message),
      );

      return;
    }
    const state = get();
    const current: CanvasHistoryState = {
      nodes: state.nodes,
      edges: state.edges,
    };

    const prev = applyPatches(current, entry.inversePatches);
    const history = _history.slice(0, -1);
    const future = [entry, ..._future];

    set({
      nodes: sortNodesAfterHistoryPatch(prev.nodes),
      edges: prev.edges,
      _history: history,
      _future: future,
      canUndo: history.length > 0,
      canRedo: true,
    });
  },

  handleRedo() {
    const { _history, _future } = get();
    if (_future.length === 0) return;

    const entry = _future[0];
    if (entry.remote) {
      if (!agentHistoryGateway) return;
      void ResultAsync.fromPromise(
        agentHistoryGateway.redo(entry.remote.changeSetId, entry.remote.version),
        (error) => (error instanceof Error ? error : new Error(String(error))),
      ).match(
        ({ snapshot, newVersion }) => {
          const historyEntry = { ...entry, remote: { ...entry.remote!, version: newVersion } };
          const future = get()._future.slice(1);
          set({
            ...toCanvasHistoryState(snapshot),
            pipelineVersion: newVersion,
            _history: [...get()._history, historyEntry],
            _future: future,
            canUndo: true,
            canRedo: future.length > 0,
          });
        },
        (error) => agentHistoryGateway?.reportError(error.message),
      );

      return;
    }
    const state = get();
    const current: CanvasHistoryState = {
      nodes: state.nodes,
      edges: state.edges,
    };

    const next = applyPatches(current, entry.patches);
    const history = [..._history, entry];
    const future = _future.slice(1);

    set({
      nodes: sortNodesAfterHistoryPatch(next.nodes),
      edges: next.edges,
      _history: history,
      _future: future,
      canUndo: true,
      canRedo: future.length > 0,
    });
  },

  clearHistory() {
    set({ _history: [], _future: [], canUndo: false, canRedo: false });
  },
});

const toCanvasHistoryState = (snapshot: PipelineGraphSnapshot): CanvasHistoryState => ({
  nodes: sortNodesAfterHistoryPatch(snapshot.nodes as PipelineNode[]),
  edges: snapshot.edges as PipelineEdge[],
});
