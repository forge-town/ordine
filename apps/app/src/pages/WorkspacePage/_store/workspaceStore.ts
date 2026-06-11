import { createContext, createElement, useContext, useRef, type ReactNode } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { WorkspacePhase } from "@repo/schemas";

export type WorkspaceCanvasRef = {
  id: string;
  label: string;
  type: "node" | "edge" | "canvas";
};

export type WorkspaceState = {
  agentOpen: boolean;
  canvasRefs: WorkspaceCanvasRef[];
  compOpen: boolean;
  dismissed: string[];
  phase: WorkspacePhase;
  pipelineId: string | null;
  addCanvasRef: (ref: WorkspaceCanvasRef) => void;
  dismiss: (id: string) => void;
  removeCanvasRef: (id: string) => void;
  resetWorkspace: () => void;
  setAgentOpen: (open: boolean) => void;
  setCompOpen: (open: boolean) => void;
  setPhase: (phase: WorkspacePhase) => void;
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

const createInitialState = (pipelineId: string | null) => ({
  agentOpen: true,
  canvasRefs: [],
  compOpen: true,
  dismissed: [],
  phase: "empty" as WorkspacePhase,
  pipelineId,
});

export const createWorkspaceStore = (pipelineId: string | null = null): WorkspaceStore =>
  createStore<WorkspaceState>()((set) => ({
    ...createInitialState(pipelineId),
    addCanvasRef: (ref) =>
      set((state) => ({
        canvasRefs: [...state.canvasRefs.filter((item) => item.id !== ref.id), ref],
      })),
    dismiss: (id) =>
      set((state) => ({
        dismissed: state.dismissed.includes(id) ? state.dismissed : [...state.dismissed, id],
      })),
    removeCanvasRef: (id) =>
      set((state) => ({
        canvasRefs: state.canvasRefs.filter((item) => item.id !== id),
      })),
    resetWorkspace: () => set(createInitialState(pipelineId)),
    setAgentOpen: (open) => set({ agentOpen: open }),
    setCompOpen: (open) => set({ compOpen: open }),
    setPhase: (phase) => set({ phase }),
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
