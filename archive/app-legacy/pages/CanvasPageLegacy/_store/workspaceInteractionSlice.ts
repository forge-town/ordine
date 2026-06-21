import type { WorkspacePhase } from "@repo/schemas";
import type { CanvasPageStoreSlice } from "./canvasPageStore";

export interface WorkspaceInteractionSlice {
  annotatingId: string | null;
  compPanelOpen: boolean;
  composingNodeIds: string[] | null;
  configNodeId: string | null;
  drillStack: string[];
  inspectEdgeId: string | null;
  phase: WorkspacePhase;
  selectedIds: string[];
  viewingAnnId: string | null;
  clearDrillStack: () => void;
  popDrillStack: () => void;
  pushDrillStack: (nodeId: string) => void;
  setAnnotatingId: (id: string | null) => void;
  setCompPanelOpen: (open: boolean) => void;
  setComposingNodeIds: (ids: string[] | null) => void;
  setConfigNodeId: (id: string | null) => void;
  setDrillStack: (stack: string[]) => void;
  setInspectEdgeId: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  setViewingAnnId: (id: string | null) => void;
  setWorkspacePhase: (phase: WorkspacePhase) => void;
  toggleCompPanelOpen: () => void;
}

export const createWorkspaceInteractionSlice = (
  set: Parameters<CanvasPageStoreSlice>[0],
): WorkspaceInteractionSlice => ({
  annotatingId: null,
  compPanelOpen: true,
  composingNodeIds: null,
  configNodeId: null,
  drillStack: [],
  inspectEdgeId: null,
  phase: "empty",
  selectedIds: [],
  viewingAnnId: null,
  clearDrillStack: () => set({ drillStack: [] }),
  popDrillStack: () =>
    set((state) => ({
      drillStack: state.drillStack.slice(0, -1),
    })),
  pushDrillStack: (nodeId) =>
    set((state) => ({
      drillStack: [...state.drillStack, nodeId],
    })),
  setAnnotatingId: (id) => set({ annotatingId: id }),
  setCompPanelOpen: (open) => set({ compPanelOpen: open }),
  setComposingNodeIds: (ids) => set({ composingNodeIds: ids ? [...ids] : null }),
  setConfigNodeId: (id) => set({ configNodeId: id }),
  setDrillStack: (stack) => set({ drillStack: [...stack] }),
  setInspectEdgeId: (id) => set({ inspectEdgeId: id }),
  setSelectedIds: (ids) => set({ selectedIds: [...ids] }),
  setViewingAnnId: (id) => set({ viewingAnnId: id }),
  setWorkspacePhase: (phase) => set({ phase }),
  toggleCompPanelOpen: () =>
    set((state) => ({
      compPanelOpen: !state.compPanelOpen,
    })),
});
