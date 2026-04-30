import { render } from "@/test/test-wrapper";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createHarnessCanvasStore, HarnessCanvasStoreContext } from "../_store/harnessCanvasStore";
import { CanvasEmptyState } from "./CanvasEmptyState";

const renderEmptyState = () => {
  const store = createHarnessCanvasStore();
  render(
    <HarnessCanvasStoreContext.Provider value={store}>
      <CanvasEmptyState />
    </HarnessCanvasStoreContext.Provider>
  );

  return store;
};

describe("CanvasEmptyState", () => {
  it("opens quick add from the primary action", async () => {
    const user = userEvent.setup();
    const store = renderEmptyState();

    await user.click(screen.getByRole("button", { name: /Quick add node|快速新建节点/ }));

    expect(store.getState().isQuickAddOpen).toBe(true);
  });

  it("shows the right-click creation hint", () => {
    renderEmptyState();

    expect(screen.getByText(/right-click blank canvas|画布空白处右键/)).toBeInTheDocument();
  });
});
