import { describe, expect, it } from "vitest";
import { createSidebarStore } from "./sidebarStore";
import { SidebarView } from "./sidebarView";

describe("sidebarStore", () => {
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
});
