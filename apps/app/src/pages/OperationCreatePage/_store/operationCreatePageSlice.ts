import type { StateCreator } from "zustand";

export interface OperationCreatePageSlice {
  skillOpen: boolean;
  scriptLangOpen: boolean;

  handleSetSkillOpen: (open: boolean) => void;
  handleToggleSkillOpen: () => void;
  handleSetScriptLangOpen: (open: boolean) => void;
  handleToggleScriptLangOpen: () => void;
}

export const createOperationCreatePageSlice: StateCreator<OperationCreatePageSlice> = (set) => ({
  skillOpen: false,
  scriptLangOpen: false,

  handleSetSkillOpen: (open) => set({ skillOpen: open }),
  handleToggleSkillOpen: () => set((state) => ({ skillOpen: !state.skillOpen })),
  handleSetScriptLangOpen: (open) => set({ scriptLangOpen: open }),
  handleToggleScriptLangOpen: () => set((state) => ({ scriptLangOpen: !state.scriptLangOpen })),
});
