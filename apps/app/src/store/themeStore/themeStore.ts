import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * N18-02：外观偏好（原型 settings.jsx General 组）。
 * `.dark` 变量集在 styles.css 已完整（含 surface/border 系），这里只负责
 * 持久化偏好并切换 documentElement class；system 跟随系统配色。
 */

export type ThemePreference = "dark" | "light" | "system";

const prefersDark = (): boolean =>
  typeof globalThis.matchMedia === "function" &&
  globalThis.matchMedia("(prefers-color-scheme: dark)").matches;

export const resolveIsDark = (preference: ThemePreference): boolean =>
  preference === "dark" || (preference === "system" && prefersDark());

export const applyThemePreference = (preference: ThemePreference): void => {
  if (typeof document === "undefined") {
    return;
  }
  document.documentElement.classList.toggle("dark", resolveIsDark(preference));
};

type ThemeState = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: "light",
      setPreference: (preference) => {
        applyThemePreference(preference);
        set({ preference });
      },
    }),
    { name: "ordine.theme" },
  ),
);
