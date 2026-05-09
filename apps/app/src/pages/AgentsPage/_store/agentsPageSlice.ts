import type { StateCreator } from "zustand";
import type { Agent } from "@repo/schemas";

export interface AgentsPageSlice {
  search: string;
  showForm: boolean;
  editing: Agent | null;

  handleSetSearch: (search: string) => void;
  handleSetShowForm: (show: boolean) => void;
  handleSetEditing: (editing: Agent | null) => void;
}

export const createAgentsPageSlice: StateCreator<AgentsPageSlice> = (set) => ({
  search: "",
  showForm: false,
  editing: null,

  handleSetSearch: (search) => set({ search }),
  handleSetShowForm: (show) => set({ showForm: show }),
  handleSetEditing: (editing) => set({ editing }),
});
