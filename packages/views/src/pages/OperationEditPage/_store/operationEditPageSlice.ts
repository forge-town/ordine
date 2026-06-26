import type { StateCreator } from "zustand";

export interface OperationEditPageSlice {
  skillOpen: boolean;
  scriptLangOpen: boolean;

  handleSkillSelectOpenChange: (open: boolean) => void;
  handleSkillSelectTriggerClick: () => void;
  handleScriptLangSelectOpenChange: (open: boolean) => void;
  handleScriptLangSelectTriggerClick: () => void;
}

export const createOperationEditPageSlice: StateCreator<OperationEditPageSlice> = (set) => ({
  skillOpen: false,
  scriptLangOpen: false,

  handleSkillSelectOpenChange: (open) => set({ skillOpen: open }),
  handleSkillSelectTriggerClick: () => set((state) => ({ skillOpen: !state.skillOpen })),
  handleScriptLangSelectOpenChange: (open) => set({ scriptLangOpen: open }),
  handleScriptLangSelectTriggerClick: () =>
    set((state) => ({ scriptLangOpen: !state.scriptLangOpen })),
});
