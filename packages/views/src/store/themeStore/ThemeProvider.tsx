import { useEffect, type ReactNode } from "react";
import { useStore } from "zustand";
import { useInit } from "../../hooks/useInit";
import {
  createThemeStore,
  ThemeStoreContext,
  useThemeStore,
  type ThemePreference,
} from "./themeStore";

export const resolveIsDark = (preference: ThemePreference) =>
  preference === "dark" ||
  (preference === "system" &&
    typeof globalThis.matchMedia === "function" &&
    globalThis.matchMedia("(prefers-color-scheme: dark)").matches);

const applyTheme = (preference: ThemePreference) => {
  if (typeof document !== "undefined") {
    const isDark = resolveIsDark(preference);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.style.colorScheme = isDark ? "dark" : "light";
  }
};

export const ThemeApplier = () => {
  const store = useThemeStore();
  const preference = useStore(store, (state) => state.preference);

  useEffect(() => {
    applyTheme(preference);
    if (preference !== "system" || typeof globalThis.matchMedia !== "function") return;

    const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [preference]);

  return null;
};

export const ThemeStoreProvider = ({ children }: { children: ReactNode }) => {
  const store = useInit(createThemeStore);

  return <ThemeStoreContext.Provider value={store}>{children}</ThemeStoreContext.Provider>;
};
