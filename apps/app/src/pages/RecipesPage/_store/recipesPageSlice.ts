import type { StateCreator } from "zustand";
import type { Recipe } from "@repo/schemas";

export interface RecipesPageSlice {
  search: string;
  showForm: boolean;
  editing: Recipe | null;

  handleSetSearch: (search: string) => void;
  handleSetShowForm: (show: boolean) => void;
  handleSetEditing: (editing: Recipe | null) => void;
}

export const createRecipesPageSlice: StateCreator<RecipesPageSlice> = (set) => ({
  search: "",
  showForm: false,
  editing: null,

  handleSetSearch: (search) => set({ search }),
  handleSetShowForm: (show) => set({ showForm: show }),
  handleSetEditing: (editing) => set({ editing }),
});
