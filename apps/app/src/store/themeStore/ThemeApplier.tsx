import { useEffect } from "react";
import { applyThemePreference, useThemeStore } from "./themeStore";

/** 挂在应用根：应用持久化的外观偏好，system 模式下跟随系统切换。 */
export const ThemeApplier = () => {
  const preference = useThemeStore((state) => state.preference);

  useEffect(() => {
    applyThemePreference(preference);
    if (preference !== "system" || typeof globalThis.matchMedia !== "function") {
      return;
    }

    const mediaQuery = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyThemePreference("system");
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [preference]);

  return null;
};
