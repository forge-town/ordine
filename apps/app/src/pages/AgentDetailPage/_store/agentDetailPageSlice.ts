import type { StateCreator } from "zustand";
import { dataProvider, ResourceName } from "@/integrations/refine/dataProvider";
import { router } from "@/router";

export interface AgentDetailPageSlice {
  deleteConfirm: boolean;
  copied: boolean;

  handleDeleteButtonClick: (agentId: string) => Promise<void>;
  handleDeleteButtonBlur: () => void;
  handleCopyIdButtonClick: (agentId: string) => Promise<void>;
}

export const createAgentDetailPageSlice: StateCreator<AgentDetailPageSlice> = (set, get) => ({
  deleteConfirm: false,
  copied: false,

  handleDeleteButtonClick: async (agentId) => {
    if (!get().deleteConfirm) {
      set({ deleteConfirm: true });

      return;
    }
    await dataProvider.deleteOne({
      resource: ResourceName.agents,
      id: agentId,
    });
    void router.navigate({ to: "/agents" });
  },

  handleDeleteButtonBlur: () => set({ deleteConfirm: false }),

  handleCopyIdButtonClick: async (agentId) => {
    await navigator.clipboard.writeText(agentId);
    set({ copied: true });
    setTimeout(() => set({ copied: false }), 1500);
  },
});
