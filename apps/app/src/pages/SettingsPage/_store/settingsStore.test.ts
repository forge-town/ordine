import { describe, it, expect, beforeEach } from "vitest";
import { useStore } from "zustand";
import { createSettingsStore } from "./settingsStore";

describe("settingsStore", () => {
  let store: ReturnType<typeof createSettingsStore>;

  beforeEach(() => {
    store = createSettingsStore();
  });

  it("is initialized with default settings", () => {
    const state = store.getState();
    expect(state.profile.displayName).toBe("Ordine 用户");
    expect(state.appearance.theme).toBe("light");
    expect(state.notifications.pipeline).toBe(true);
    expect(state.language.language).toBe("zh-CN");
    expect(state.saved).toBe(false);
  });

  it("updates a section via updateSection", () => {
    store.getState().updateSection("profile", { displayName: "New Name" });
    expect(store.getState().profile.displayName).toBe("New Name");
    expect(store.getState().profile.email).toBe("user@ordine.app");
  });

  it("updates appearance section", () => {
    store.getState().updateSection("appearance", { theme: "dark" });
    expect(store.getState().appearance.theme).toBe("dark");
  });

  it("updates notifications section", () => {
    store.getState().updateSection("notifications", { pipeline: false });
    expect(store.getState().notifications.pipeline).toBe(false);
    expect(store.getState().notifications.mention).toBe(true);
  });

  it("saves settings and sets saved flag", () => {
    store.getState().updateSection("profile", { displayName: "Saved User" });
    store.getState().save();
    expect(store.getState().saved).toBe(true);
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
