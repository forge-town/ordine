import { describe, it, expect, beforeEach } from "vitest";
import { createSettingsStore } from "./settingsStore";

describe("settingsStore", () => {
  const ctx = { store: null as ReturnType<typeof createSettingsStore> | null };

  beforeEach(() => {
    ctx.store = createSettingsStore();
  });

  it("is initialized with default settings", () => {
    const state = ctx.store!.getState();
    expect(state.profile.displayName).toBe("Ordine 用户");
    expect(state.appearance.theme).toBe("light");
    expect(state.notifications.pipeline).toBe(true);
    expect(state.language.language).toBe("zh-CN");
    expect(state.saved).toBe(false);
  });

  it("updates a section via updateSection", () => {
    ctx.store!.getState().updateSection("profile", { displayName: "New Name" });
    expect(ctx.store!.getState().profile.displayName).toBe("New Name");
    expect(ctx.store!.getState().profile.email).toBe("user@ordine.app");
  });

  it("updates appearance section", () => {
    ctx.store!.getState().updateSection("appearance", { theme: "dark" });
    expect(ctx.store!.getState().appearance.theme).toBe("dark");
  });

  it("updates notifications section", () => {
    ctx.store!.getState().updateSection("notifications", { pipeline: false });
    expect(ctx.store!.getState().notifications.pipeline).toBe(false);
    expect(ctx.store!.getState().notifications.mention).toBe(true);
  });

  it("saves settings and sets saved flag", () => {
    ctx.store!.getState().updateSection("profile", { displayName: "Saved User" });
    ctx.store!.getState().save();
    expect(ctx.store!.getState().saved).toBe(true);
  });

  it("loads initial settings from provided values", () => {
    const customStore = createSettingsStore({
      profile: {
        displayName: "Custom",
        email: "custom@test.com",
        bio: "Test bio",
      },
    });
    expect(customStore.getState().profile.displayName).toBe("Custom");
    expect(customStore.getState().appearance.theme).toBe("light");
  });
});
