import { describe, expect, it } from "vitest";
import { resolveInitialThemeIsDark, themeInitializationScript } from "./themeInitialization";

describe("theme initialization", () => {
  it.each([
    ["dark", false, true],
    ["light", true, false],
    ["system", true, true],
    ["system", false, false],
  ] as const)("resolves %s with system dark=%s", (preference, prefersDark, expected) => {
    expect(resolveInitialThemeIsDark(preference, prefersDark)).toBe(expected);
  });

  it("restores the persisted theme before the application mounts", () => {
    expect(themeInitializationScript).toContain('localStorage.getItem("ordine.theme")');
    expect(themeInitializationScript).toContain("document.documentElement.classList.toggle");
    expect(themeInitializationScript).toContain("document.documentElement.style.colorScheme");
  });
});
