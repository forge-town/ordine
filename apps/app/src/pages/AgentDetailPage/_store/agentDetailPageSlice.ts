import type { StateCreator } from "zustand";

export interface AgentDetailPageSlice {
  deleteConfirm: boolean;
  copied: boolean;

  handleDeleteConfirmSet: (confirm: boolean) => void;
  handleDeleteBlur: () => void;
  handleCopied: () => void;
}

export const createAgentDetailPageSlice: StateCreator<AgentDetailPageSlice> = (set) => ({
  deleteConfirm: false,
  copied: false,

  handleDeleteConfirmSet: (confirm) => set({ deleteConfirm: confirm }),
  handleDeleteBlur: () => set({ deleteConfirm: false }),
  handleCopied: () => {
    set({ copied: true });
    setTimeout(() => set({ copied: false }), 1500);
  },
});
