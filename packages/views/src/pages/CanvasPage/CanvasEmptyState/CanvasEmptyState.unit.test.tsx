import { render } from "../../../test/test-wrapper";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store/canvasPageStore";
import { CanvasEmptyState } from "./CanvasEmptyState";

const renderEmptyState = () => {
  const store = createCanvasPageStore();
  render(
    <CanvasPageStoreContext.Provider value={store}>
      <CanvasEmptyState />
    </CanvasPageStoreContext.Provider>,
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

  it("uses the centered Alan empty-state layout without the context hint", () => {
    renderEmptyState();

    expect(screen.getByTestId("canvas-v2-empty-state")).toHaveClass(
      "pointer-events-none",
      "absolute",
      "inset-0",
      "z-[1]",
      "grid",
      "place-items-center",
      "px-6",
    );
    expect(screen.getByRole("heading")).toHaveClass("text-base");
    expect(screen.queryByText(/right-click blank canvas|画布空白处右键/)).not.toBeInTheDocument();
  });

  it("leaves room for the open component panel on desktop", () => {
    renderEmptyState();

    expect(screen.getByTestId("canvas-v2-empty-state")).toHaveClass("min-[1181px]:pl-[246px]");
  });
});
