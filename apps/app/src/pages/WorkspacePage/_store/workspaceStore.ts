import { create } from "zustand";
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

const initialState = {
  agentOpen: true,
  canvasRefs: [],
  compOpen: true,
  dismissed: [],
  phase: "empty" as WorkspacePhase,
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  ...initialState,
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
  resetWorkspace: () => set(initialState),
  setAgentOpen: (open) => set({ agentOpen: open }),
  setCompOpen: (open) => set({ compOpen: open }),
  setPhase: (phase) => set({ phase }),
  toggleAgentOpen: () => set((state) => ({ agentOpen: !state.agentOpen })),
  toggleCompOpen: () => set((state) => ({ compOpen: !state.compOpen })),
}));
