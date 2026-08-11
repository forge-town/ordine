import { render } from "../../../test/test-wrapper";
import i18n from "i18next";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store";
import { CanvasTopChrome } from "./CanvasTopChrome";

vi.mock("../CanvasToolbar", () => ({
  CanvasToolbar: () => <div data-testid="canvas-toolbar">Toolbar</div>,
}));

const renderTopChrome = () => {
  const store = createCanvasPageStore([], []);

  render(
    <CanvasPageStoreContext.Provider value={store}>
      <CanvasTopChrome />
    </CanvasPageStoreContext.Provider>,
  );

  return store;
};

describe("CanvasTopChrome", () => {
  it("renders the shell top bar with title and toolbar", () => {
    renderTopChrome();

    expect(screen.getByTestId("canvas-top-chrome")).toHaveClass(
      "border-b",
      "bg-background/95",
      "backdrop-blur",
    );
    const toolbarSlot = screen.getByTestId("canvas-toolbar").parentElement;
    expect(toolbarSlot).not.toBeNull();
    expect(toolbarSlot as HTMLElement).toHaveClass("min-w-0", "max-w-full", "overflow-x-auto");
    expect(screen.getByTestId("canvas-title-desktop")).toHaveClass("min-w-0", "shrink-0");
    expect(screen.getByTestId("canvas-title-desktop").firstElementChild).toHaveClass(
      "min-w-0",
      "shadow-soft",
      "ring-1",
    );
    expect(toolbarSlot as HTMLElement).toHaveClass("flex-1");
  });

  it("preserves pipeline title editing", async () => {
    const user = userEvent.setup();
    const store = renderTopChrome();
    const desktopTitleInput = screen.getByRole("textbox", {
      name: i18n.t("canvas.pipelineTitle"),
    });

    await user.clear(desktopTitleInput);
    await user.type(desktopTitleInput, "Aligned pipeline");

    expect(store.getState().pipelineName).toBe("Aligned pipeline");
  });
});
