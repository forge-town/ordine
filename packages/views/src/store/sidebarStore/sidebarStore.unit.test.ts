import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSidebarStore } from "./sidebarStore";
import { SidebarView } from "./sidebarView";

describe("sidebarStore", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selects a view from the current route", () => {
    const store = createSidebarStore();

    store.getState().handleSidebarLocationChange("/canvas/pipeline-1");
    expect(store.getState().view).toBe(SidebarView.Pipeline);

    store.getState().handleSidebarLocationChange("/jobs");
    expect(store.getState().view).toBe(SidebarView.Main);
  });

  it("controls sidebar dialogs", () => {
    const store = createSidebarStore();

    store.getState().handleSearchButtonClick();
    store.getState().handleNewPipelineButtonClick();
    expect(store.getState()).toMatchObject({ searchOpen: true, newPipelineOpen: true });

    store.getState().handleSearchDialogOpenChange(false);
    expect(store.getState().searchOpen).toBe(false);
  });

  it("persists the capabilities section state", () => {
    const store = createSidebarStore();

    expect(store.getState().capabilitiesOpen).toBe(true);
    store.getState().handleCapabilitiesToggle();

    expect(store.getState().capabilitiesOpen).toBe(false);
    expect(localStorage.getItem("ordine.sidebar.capabilitiesOpen")).toBe("false");
    expect(createSidebarStore().getState().capabilitiesOpen).toBe(false);
  });
});
