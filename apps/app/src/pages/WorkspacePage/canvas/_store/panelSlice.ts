import type { StateCreator } from "zustand";

export type CanvasTool = "hand" | "select";

export type PanelSlice = {
  annotatingId: string | null;
  askNodeId: string | null;
  canvasTool: CanvasTool;
  compPanelOpen: boolean;
  composingNodeIds: string[] | null;
  configNodeId: string | null;
  inspectEdgeId: string | null;
  viewingAnnId: string | null;
  closePanels: () => void;
  openEdgeInspector: (edgeId: string) => void;
  openNodeConfig: (nodeId: string) => void;
  setAnnotatingId: (id: string | null) => void;
  setAskNodeId: (id: string | null) => void;
  setCanvasTool: (tool: CanvasTool) => void;
  setCompPanelOpen: (open: boolean) => void;
  setComposingNodeIds: (ids: string[] | null) => void;
  setConfigNodeId: (id: string | null) => void;
  setInspectEdgeId: (id: string | null) => void;
  setViewingAnnId: (id: string | null) => void;
  toggleCompPanelOpen: () => void;
};

export const createPanelSlice =
  <T extends PanelSlice>(): StateCreator<T, [], [], PanelSlice> =>
  (set) => ({
    annotatingId: null,
    askNodeId: null,
    canvasTool: "select",
    compPanelOpen: false,
    composingNodeIds: null,
    configNodeId: null,
    inspectEdgeId: null,
    viewingAnnId: null,
    closePanels: () =>
      set({
        annotatingId: null,
        askNodeId: null,
        composingNodeIds: null,
        configNodeId: null,
        inspectEdgeId: null,
        viewingAnnId: null,
      } as Partial<T>),
    openEdgeInspector: (edgeId) =>
      set({
        configNodeId: null,
        inspectEdgeId: edgeId,
      } as Partial<T>),
    openNodeConfig: (nodeId) =>
      set({
        configNodeId: nodeId,
        inspectEdgeId: null,
      } as Partial<T>),
    setAnnotatingId: (id) => set({ annotatingId: id } as Partial<T>),
    setAskNodeId: (id) => set({ askNodeId: id } as Partial<T>),
    setCanvasTool: (tool) => set({ canvasTool: tool } as Partial<T>),
    setCompPanelOpen: (open) => set({ compPanelOpen: open } as Partial<T>),
    setComposingNodeIds: (ids) => set({ composingNodeIds: ids ? [...ids] : null } as Partial<T>),
    setConfigNodeId: (id) => set({ configNodeId: id } as Partial<T>),
    setInspectEdgeId: (id) => set({ inspectEdgeId: id } as Partial<T>),
    setViewingAnnId: (id) => set({ viewingAnnId: id } as Partial<T>),
    toggleCompPanelOpen: () =>
      set(
        (state) =>
          ({
            compPanelOpen: !state.compPanelOpen,
          }) as Partial<T>,
      ),
  });
