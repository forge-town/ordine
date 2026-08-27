import { describe, expect, it } from "vitest";
import { createStore } from "zustand/vanilla";
import { createSidebarSlice, type SidebarSlice } from "./sidebarSlice";

describe("sidebarSlice", () => {
  it("increments the home workspace version for every new-Pipeline request", () => {
    const store = createStore<SidebarSlice>()(createSidebarSlice);

    expect(store.getState().newPipelineWorkspaceVersion).toBe(0);
    store.getState().handleNewPipelineWorkspaceReset();
    store.getState().handleNewPipelineWorkspaceReset();

    expect(store.getState().newPipelineWorkspaceVersion).toBe(2);
  });
});
