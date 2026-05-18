import type { StateCreator } from "zustand";

interface DeleteAgentDependencies {
  deleteAgent: (agentId: string) => Promise<unknown>;
  navigateToAgents: () => void;
}

export interface AgentDetailPageSlice {
  deleteConfirm: boolean;
  copied: boolean;

  handleDeleteButtonClick: (
    agentId: string,
    dependencies: DeleteAgentDependencies,
  ) => Promise<void>;
  handleDeleteButtonBlur: () => void;
  handleCopyIdButtonClick: (
    agentId: string,
    copyAgentId: (agentId: string) => Promise<boolean>,
  ) => Promise<void>;
}

export const createAgentDetailPageSlice: StateCreator<AgentDetailPageSlice> = (set, get) => ({
  deleteConfirm: false,
  copied: false,

  handleDeleteButtonClick: async (agentId, dependencies) => {
    if (!get().deleteConfirm) {
      set({ deleteConfirm: true });

      return;
    }
    await dependencies.deleteAgent(agentId);
    dependencies.navigateToAgents();
  },

  handleDeleteButtonBlur: () => set({ deleteConfirm: false }),

  handleCopyIdButtonClick: async (agentId, copyAgentId) => {
    const copied = await copyAgentId(agentId);
    if (copied) {
      set({ copied: true });
      setTimeout(() => set({ copied: false }), 1500);
    }
  },
});
