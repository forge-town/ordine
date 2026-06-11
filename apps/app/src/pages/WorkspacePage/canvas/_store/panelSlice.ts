import type { StateCreator } from "zustand";

export type PanelSlice = {
  annotatingId: string | null;
  compPanelOpen: boolean;
  composingNodeIds: string[] | null;
  configNodeId: string | null;
  inspectEdgeId: string | null;
  viewingAnnId: string | null;
  closePanels: () => void;
  openEdgeInspector: (edgeId: string) => void;
  openNodeConfig: (nodeId: string) => void;
  setAnnotatingId: (id: string | null) => void;
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
    compPanelOpen: true,
    composingNodeIds: null,
    configNodeId: null,
    inspectEdgeId: null,
    viewingAnnId: null,
    closePanels: () =>
      set({
        annotatingId: null,
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
