import { describe, it, expect, beforeEach, vi } from "vitest";
import { createSettingsPageStore } from "./settingsPageStore";

Object.defineProperty(globalThis, "localStorage", {
  value: { getItem: vi.fn(() => null), setItem: vi.fn() },
  writable: true,
});

describe("settingsPageStore", () => {
  const ctx = { store: null as ReturnType<typeof createSettingsPageStore> | null };

  beforeEach(() => {
    ctx.store = createSettingsPageStore();
  });

  it("is initialized with default settings", () => {
    const state = ctx.store!.getState();
    expect(state.language.language).toBe("zh-CN");
    expect(state.saved).toBe(false);
  });

  it("updates language section", () => {
    ctx.store!.getState().updateSection("language", { language: "en" });
    expect(ctx.store!.getState().language.language).toBe("en");
  });

  it("saves settings and sets saved flag", () => {
    ctx.store!.getState().updateSection("language", { language: "en" });
    ctx.store!.getState().save();
    expect(ctx.store!.getState().saved).toBe(true);
  });

  it("loads initial settings from provided values", () => {
    const customStore = createSettingsPageStore({
      language: { language: "ja-JP", timezone: "Asia/Tokyo" },
    });
    expect(customStore.getState().language.language).toBe("ja-JP");
  });
});
