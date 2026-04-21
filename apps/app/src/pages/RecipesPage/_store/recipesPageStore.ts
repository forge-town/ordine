import { createContext, useContext } from "react";
import { createStore, type StoreApi, type StateCreator } from "zustand";
import { createRecipesPageSlice, type RecipesPageSlice } from "./recipesPageSlice";

export interface RecipesPageState extends RecipesPageSlice {}

export type RecipesPageStoreSlice<T = RecipesPageState> = StateCreator<RecipesPageState, [], [], T>;

export type RecipesPageStore = StoreApi<RecipesPageState>;

export const createRecipesPageStore = () => {
  return createStore<RecipesPageState>()((set, get, api) => ({
    ...createRecipesPageSlice(set, get, api),
  }));
};

export const RecipesPageStoreContext = createContext<RecipesPageStore | null>(null);

export const useRecipesPageStore = () => {
  const context = useContext(RecipesPageStoreContext);
  if (!context) {
    throw new Error("useRecipesPageStore must be used within a RecipesPageStoreProvider");
  }

  return context;
};
