import type { StateCreator } from "zustand";

export interface ProjectWorkspacePageSlice {
  selectedObjects: Set<string>;
  selectedPipelineId: string | null;

  handleToggleObject: (path: string) => void;
  handleSelectPipeline: (id: string) => void;
  handleClearSelectedObjects: () => void;
}

export const createProjectWorkspacePageSlice: StateCreator<ProjectWorkspacePageSlice> = (set) => ({
  selectedObjects: new Set(),
  selectedPipelineId: null,

  handleToggleObject: (path) =>
    set((state) => {
      const next = new Set(state.selectedObjects);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return { selectedObjects: next };
    }),
  handleSelectPipeline: (id) =>
    set((state) => ({
      selectedPipelineId: state.selectedPipelineId === id ? null : id,
    })),
  handleClearSelectedObjects: () => set({ selectedObjects: new Set() }),
});
