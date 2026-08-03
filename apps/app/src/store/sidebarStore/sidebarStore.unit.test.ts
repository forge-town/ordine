import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStore } from "zustand";
import { createSidebarSlice, type SidebarSlice } from "./sidebarSlice";

const createTestStore = () => createStore<SidebarSlice>()(createSidebarSlice);

const createLocalStorageMock = () => {
  const values = new Map<string, string>();

  return {
    clear: vi.fn(() => values.clear()),
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    removeItem: vi.fn((key: string) => values.delete(key)),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
};

describe("sidebarStore", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("persists the current project id", () => {
    const store = createTestStore();

    store.getState().handleCurrentProjectChange("project-1");

    expect(store.getState().currentProjectId).toBe("project-1");
    expect(localStorage.getItem("ordine.sidebar.currentProjectId")).toBe("project-1");
    expect(createTestStore().getState().currentProjectId).toBe("project-1");
  });

  it("persists the capabilities section state", () => {
    const store = createTestStore();

    store.getState().handleCapabilitiesToggle();

    expect(store.getState().capabilitiesOpen).toBe(false);
    expect(localStorage.getItem("ordine.sidebar.capabilitiesOpen")).toBe("false");
    expect(createTestStore().getState().capabilitiesOpen).toBe(false);
  });

  it("opens global search while typing and closes when cleared", () => {
    const store = createTestStore();

    store.getState().handleSidebarSearchChange("lead");

    expect(store.getState().searchOpen).toBe(true);
    expect(store.getState().sidebarSearchQuery).toBe("lead");

    store.getState().handleSidebarSearchClear();

    expect(store.getState().searchOpen).toBe(false);
    expect(store.getState().sidebarSearchQuery).toBe("");
  });
});
