import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CanvasPageStoreContext, createCanvasPageStore } from "../_store";
import { CanvasMiniSidebar } from "./CanvasMiniSidebar";

const renderMiniSidebar = () => {
  const store = createCanvasPageStore();

  render(
    <CanvasPageStoreContext.Provider value={store}>
      <CanvasMiniSidebar />
    </CanvasPageStoreContext.Provider>,
  );

  return store;
};

describe("CanvasMiniSidebar", () => {
  it("opens workspace, toggles node cards, and opens settings", async () => {
    const user = userEvent.setup();
    const store = renderMiniSidebar();

    const workspaceButton = screen.getByRole("button", { name: /Workspace/i });
    expect(workspaceButton).toHaveAttribute("aria-expanded", "false");

    await user.click(workspaceButton);
    expect(store.getState().isWorkspaceSidebarOpen).toBe(true);
    expect(workspaceButton).toHaveAttribute("aria-expanded", "true");

    const compactCardsButton = screen.getByRole("button", { name: /Compact cards/i });
    expect(compactCardsButton).toHaveAttribute("aria-pressed", "true");

    await user.click(compactCardsButton);
    expect(store.getState().nodeCardMode).toBe("expanded");
    expect(compactCardsButton).toHaveAttribute("aria-pressed", "false");

    await user.click(compactCardsButton);
    expect(store.getState().nodeCardMode).toBe("compact");
    expect(compactCardsButton).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: /Settings|设置/i }));
    expect(store.getState().isCanvasSettingsOpen).toBe(true);
  });
});
