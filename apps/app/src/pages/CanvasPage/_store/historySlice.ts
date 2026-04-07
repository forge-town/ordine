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
import type { HarnessCanvasStoreSlice } from "./harnessCanvasStore";
import type { PipelineNode, PipelineEdge } from "./canvasSlice";

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
  | "CLEAR_CANVAS";

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
}

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

  undo: () => void;
  redo: () => void;
  clearHistory: () => void;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export const createHistorySlice = (
  set: Parameters<HarnessCanvasStoreSlice>[0],
  get: Parameters<HarnessCanvasStoreSlice>[1]
): HistorySlice => ({
  _history: [],
  _future: [],
  _maxHistory: 100,

  canUndo: false,
  canRedo: false,

  recordCommand(command, mutate) {
    const state = get();
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

  undo() {
    const { _history, _future } = get();
    if (_history.length === 0) return;

    const entry = _history.at(-1);
    if (!entry) return;
    const state = get();
    const current: CanvasHistoryState = {
      nodes: state.nodes,
      edges: state.edges,
    };

    const prev = applyPatches(current, entry.inversePatches);
    const history = _history.slice(0, -1);
    const future = [entry, ..._future];

    set({
      nodes: prev.nodes,
      edges: prev.edges,
      _history: history,
      _future: future,
      canUndo: history.length > 0,
      canRedo: true,
    });
  },

  redo() {
    const { _history, _future } = get();
    if (_future.length === 0) return;

    const entry = _future[0];
    const state = get();
    const current: CanvasHistoryState = {
      nodes: state.nodes,
      edges: state.edges,
    };

    const next = applyPatches(current, entry.patches);
    const history = [..._history, entry];
    const future = _future.slice(1);

    set({
      nodes: next.nodes,
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
