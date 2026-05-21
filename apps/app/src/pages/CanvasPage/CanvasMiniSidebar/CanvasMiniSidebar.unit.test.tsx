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

    await user.click(screen.getByRole("button", { name: /Workspace/i }));
    expect(store.getState().isWorkspaceSidebarOpen).toBe(true);

    await user.click(screen.getByRole("button", { name: /Compact cards/i }));
    expect(store.getState().nodeCardMode).toBe("expanded");

    await user.click(screen.getByRole("button", { name: /Expanded cards/i }));
    expect(store.getState().nodeCardMode).toBe("compact");

    await user.click(screen.getByRole("button", { name: /Settings|设置/i }));
    expect(store.getState().isCanvasSettingsOpen).toBe(true);
  });
});
