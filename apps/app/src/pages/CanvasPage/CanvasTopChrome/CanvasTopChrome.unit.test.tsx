import { render } from "@/test/test-wrapper";
import i18n from "@/lib/i18n";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createCanvasPageStore, CanvasPageStoreContext } from "../_store";
import { CanvasTopChrome } from "./CanvasTopChrome";

vi.mock("../CanvasFloatingMenu", () => ({
  CanvasFloatingMenu: () => (
    <button className="pointer-events-auto h-10 w-10" title="菜单" type="button">
      Menu
    </button>
  ),
}));

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
  it("uses one top chrome coordinate system for menu, title, and toolbar", () => {
    renderTopChrome();

    expect(screen.getByTestId("canvas-top-chrome")).toHaveClass(
      "absolute",
      "top-3",
      "z-50",
      "pointer-events-none",
    );
    const toolbarSlot = screen.getByTestId("canvas-toolbar").parentElement;
    expect(toolbarSlot).not.toBeNull();
    expect(toolbarSlot as HTMLElement).toHaveClass(
      "max-w-full",
      "overflow-x-auto",
      "max-[420px]:justify-self-start",
    );
    expect(screen.getByTestId("canvas-title-desktop")).toHaveClass("hidden", "min-[700px]:flex");
    expect(screen.getByTestId("canvas-title-narrow")).toHaveClass("mt-2", "min-[700px]:hidden");
  });

  it("preserves pipeline title editing", async () => {
    const user = userEvent.setup();
    const store = renderTopChrome();
    const [desktopTitleInput] = screen.getAllByRole("textbox", {
      name: i18n.t("canvas.pipelineTitle"),
    });

    await user.clear(desktopTitleInput);
    await user.type(desktopTitleInput, "Aligned pipeline");

    expect(store.getState().pipelineName).toBe("Aligned pipeline");
  });
});
