import { createContext, createElement, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { WorkspaceCanvasRef, WorkspacePhase } from "@repo/schemas";

export type { WorkspaceCanvasRef };

export type WorkspaceSpotlight = {
  nonce: number;
  ref: WorkspaceCanvasRef;
};

export type WorkspaceThread = {
  id: string;
  label: string;
};

export type WorkspacePendingAsk = {
  nonce: number;
  ref: WorkspaceCanvasRef;
  text: string;
};

export type WorkspaceState = {
  agentOpen: boolean;
  canvasRefs: WorkspaceCanvasRef[];
  compOpen: boolean;
  composerFocusNonce: number;
  dismissed: string[];
  hoverRefId: string | null;
  pendingAsk: WorkspacePendingAsk | null;
  phase: WorkspacePhase;
  pipelineId: string | null;
  spotlight: WorkspaceSpotlight | null;
  thread: WorkspaceThread | null;
  addCanvasRef: (ref: WorkspaceCanvasRef) => void;
  clearPendingAsk: () => void;
  dismiss: (id: string) => void;
  focusComposer: () => void;
  focusRef: (ref: WorkspaceCanvasRef) => void;
  removeCanvasRef: (id: string) => void;
  requestAsk: (ref: WorkspaceCanvasRef, text: string) => void;
  resetWorkspace: () => void;
  setAgentOpen: (open: boolean) => void;
  setCanvasRefs: (refs: WorkspaceCanvasRef[]) => void;
  setCompOpen: (open: boolean) => void;
  setHoverRef: (id: string | null) => void;
  setPhase: (phase: WorkspacePhase) => void;
  setThread: (thread: WorkspaceThread | null) => void;
  toggleAgentOpen: () => void;
  toggleCompOpen: () => void;
};

export type WorkspaceStore = StoreApi<WorkspaceState>;

type UseWorkspaceStore = {
  <T>(selector: (state: WorkspaceState) => T): T;
  getInitialState: WorkspaceStore["getInitialState"];
  getState: WorkspaceStore["getState"];
  setState: WorkspaceStore["setState"];
  subscribe: WorkspaceStore["subscribe"];
};

const sameRefIds = (a: readonly WorkspaceCanvasRef[], b: readonly WorkspaceCanvasRef[]) =>
  a.length === b.length && a.every((ref, index) => ref.id === b[index]?.id);

const createInitialState = (pipelineId: string | null) => ({
  agentOpen: true,
  canvasRefs: [],
  compOpen: true,
  composerFocusNonce: 0,
  dismissed: [],
  hoverRefId: null,
  pendingAsk: null,
  phase: "empty" as WorkspacePhase,
  pipelineId,
  spotlight: null,
  thread: null,
});

export const createWorkspaceStore = (pipelineId: string | null = null): WorkspaceStore =>
  createStore<WorkspaceState>()((set) => ({
    ...createInitialState(pipelineId),
    addCanvasRef: (ref) =>
      set((state) => ({
        canvasRefs: [...state.canvasRefs.filter((item) => item.id !== ref.id), ref],
      })),
    clearPendingAsk: () => set({ pendingAsk: null }),
    dismiss: (id) =>
      set((state) => ({
        dismissed: state.dismissed.includes(id) ? state.dismissed : [...state.dismissed, id],
      })),
    focusComposer: () =>
      set((state) => ({ agentOpen: true, composerFocusNonce: state.composerFocusNonce + 1 })),
    focusRef: (ref) =>
      set((state) => ({
        spotlight: { nonce: (state.spotlight?.nonce ?? 0) + 1, ref },
      })),
    removeCanvasRef: (id) =>
      set((state) => ({
        canvasRefs: state.canvasRefs.filter((item) => item.id !== id),
      })),
    requestAsk: (ref, text) =>
      set((state) => ({
        agentOpen: true,
        pendingAsk: { nonce: (state.pendingAsk?.nonce ?? 0) + 1, ref, text },
      })),
    resetWorkspace: () => set(createInitialState(pipelineId)),
    setAgentOpen: (open) => set({ agentOpen: open }),
    setCanvasRefs: (refs) =>
      set((state) =>
        sameRefIds(state.canvasRefs, refs)
          ? { canvasRefs: [...refs] }
          : { canvasRefs: [...refs], dismissed: [] },
      ),
    setCompOpen: (open) => set({ compOpen: open }),
    setHoverRef: (id) => set({ hoverRefId: id }),
    setPhase: (phase) => set({ phase }),
    setThread: (thread) => set({ thread }),
    toggleAgentOpen: () => set((state) => ({ agentOpen: !state.agentOpen })),
    toggleCompOpen: () => set((state) => ({ compOpen: !state.compOpen })),
  }));

const defaultWorkspaceStore = createWorkspaceStore(null);
const WorkspaceStoreContext = createContext<WorkspaceStore | null>(null);

export const WorkspaceStoreProvider = ({
  children,
  pipelineId,
}: {
  children: ReactNode;
  pipelineId: string | null;
}) => {
  const storeRef = useRef<WorkspaceStore | null>(null);

  if (!storeRef.current || storeRef.current.getState().pipelineId !== pipelineId) {
    storeRef.current = createWorkspaceStore(pipelineId);
  }

  return createElement(WorkspaceStoreContext.Provider, { value: storeRef.current }, children);
};

const useWorkspaceStoreSelector = <T>(selector: (state: WorkspaceState) => T): T => {
  const store = useContext(WorkspaceStoreContext) ?? defaultWorkspaceStore;

  return useStore(store, selector);
};

export const useWorkspaceStore = Object.assign(useWorkspaceStoreSelector, {
  getInitialState: defaultWorkspaceStore.getInitialState,
  getState: defaultWorkspaceStore.getState,
  setState: defaultWorkspaceStore.setState,
  subscribe: defaultWorkspaceStore.subscribe,
}) satisfies UseWorkspaceStore;
