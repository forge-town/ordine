import { createContext, useContext } from "react";
import { createStore, type StoreApi } from "zustand";
import { persist } from "zustand/middleware";

export type ThemePreference = "light" | "dark" | "system";

export interface ThemeState {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

export type ThemeStore = StoreApi<ThemeState>;

export const createThemeStore = (): ThemeStore =>
  createStore<ThemeState>()(
    persist(
      (set) => ({
        preference: "system",
        setPreference: (preference) => set({ preference }),
      }),
      { name: "ordine.theme" },
    ),
  );

export const themeStore = createThemeStore();
export const ThemeStoreContext = createContext<ThemeStore | null>(null);

export const useThemeStore = () => {
  const store = useContext(ThemeStoreContext);
  if (!store) throw new Error("useThemeStore must be used within ThemeStoreProvider");

  return store;
};
