import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  createNotificationStore,
  NotificationStoreContext,
} from "../../../store/notificationStore";
import { CanvasPageStoreContext, createCanvasPageStore } from "../_store";
import { CanvasMiniSidebar } from "./CanvasMiniSidebar";
import "../../../test/use-test-language";

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

const renderMiniSidebar = () => {
  const store = createCanvasPageStore();
  const notificationStore = createNotificationStore();

  render(
    <NotificationStoreContext.Provider value={notificationStore}>
      <CanvasPageStoreContext.Provider value={store}>
        <CanvasMiniSidebar />
      </CanvasPageStoreContext.Provider>
    </NotificationStoreContext.Provider>,
  );

  return store;
};

describe("CanvasMiniSidebar", () => {
  it("opens workspace, toggles node cards, and opens settings", async () => {
    const user = userEvent.setup();
    const store = renderMiniSidebar();

    expect(screen.getByRole("button", { name: /Notifications|通知/i })).toBeInTheDocument();

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
