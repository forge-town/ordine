import { describe, expect, it, vi } from "vitest";
import { createThemeStore } from "./themeStore";
import { resolveIsDark } from "./ThemeProvider";

describe("themeStore", () => {
  it("stores an explicit theme preference", () => {
    const store = createThemeStore();

    store.getState().setPreference("dark");

    expect(store.getState().preference).toBe("dark");
  });

  it("resolves system theme from matchMedia", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );

    expect(resolveIsDark("system")).toBe(true);
    expect(resolveIsDark("light")).toBe(false);

    vi.unstubAllGlobals();
  });
});
