import type { StateCreator } from "zustand";
import type { RecipeRecord } from "@repo/db-schema";

export interface RecipesPageSlice {
  search: string;
  showForm: boolean;
  editing: RecipeRecord | null;

  handleSetSearch: (search: string) => void;
  handleSetShowForm: (show: boolean) => void;
  handleSetEditing: (editing: RecipeRecord | null) => void;
}

export const createRecipesPageSlice: StateCreator<RecipesPageSlice> = (set) => ({
  search: "",
  showForm: false,
  editing: null,

  handleSetSearch: (search) => set({ search }),
  handleSetShowForm: (show) => set({ showForm: show }),
  handleSetEditing: (editing) => set({ editing }),
});
