import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSidebarStore } from "./sidebarStore";
import { SidebarView } from "./sidebarView";

describe("sidebarStore", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
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

  it("persists and validates the current project", () => {
    const store = createSidebarStore();

    store.getState().setCurrentProjectId("project-2");
    expect(store.getState().currentProjectId).toBe("project-2");
    expect(localStorage.getItem("ordine.sidebar.currentProjectId")).toBe("project-2");

    store.getState().syncCurrentProjectId(["project-1", "project-3"]);
    expect(store.getState().currentProjectId).toBeNull();
    expect(localStorage.getItem("ordine.sidebar.currentProjectId")).toBeNull();

    store.getState().setCurrentProjectId("project-3");
    store.getState().syncCurrentProjectId([]);
    expect(store.getState().currentProjectId).toBeNull();
    expect(localStorage.getItem("ordine.sidebar.currentProjectId")).toBeNull();
  });
});
