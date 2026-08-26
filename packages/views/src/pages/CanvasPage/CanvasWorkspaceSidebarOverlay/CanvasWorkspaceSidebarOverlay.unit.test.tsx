import { render, screen } from "@testing-library/react";
import type * as RefineCore from "@refinedev/core";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CanvasPageStoreContext, createCanvasPageStore } from "../_store";
import { CanvasWorkspaceSidebarOverlay } from "./CanvasWorkspaceSidebarOverlay";

const refineMocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@refinedev/core", async (importOriginal) => ({
  ...(await importOriginal<typeof RefineCore>()),
  useCreate: () => ({ mutate: refineMocks.create, mutation: { isPending: false } }),
  useUpdate: () => ({ mutate: refineMocks.update, mutation: { isPending: false } }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: React.PropsWithChildren<{ to: string }>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const renderOpenOverlay = () => {
  const store = createCanvasPageStore([], [], "pipe-1", "Pipeline");
  store.setState({ isWorkspaceSidebarOpen: true });

  render(
    <CanvasPageStoreContext.Provider value={store}>
      <CanvasWorkspaceSidebarOverlay />
    </CanvasPageStoreContext.Provider>,
  );

  return store;
};

describe("CanvasWorkspaceSidebarOverlay", () => {
  it("renders workspace links and saves the current pipeline", async () => {
    const user = userEvent.setup();
    const store = renderOpenOverlay();

    expect(screen.getByTestId("canvas-workspace-sidebar-overlay")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pipelines|流水线/i })).toHaveAttribute(
      "href",
      "/pipelines",
    );
    expect(screen.getByRole("link", { name: /Schedule|定时任务/i })).toHaveAttribute(
      "href",
      "/schedule",
    );
    expect(screen.getByRole("link", { name: /Plugins|插件/i })).toHaveAttribute("href", "/plugins");
    expect(screen.getByRole("link", { name: /Agents|智能体/i })).toHaveAttribute("href", "/agents");
    expect(screen.getByRole("link", { name: /Conversations|对话/i })).toHaveAttribute(
      "href",
      "/assistant",
    );

    await user.click(screen.getByRole("button", { name: /Save|保存/i }));

    expect(refineMocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "pipelines",
        id: "pipe-1",
      }),
    );
    expect(store.getState().isWorkspaceSidebarOpen).toBe(false);
  });

  it("renders a single close control", () => {
    renderOpenOverlay();

    expect(
      screen.getAllByRole("button", { name: /Close|关闭|canvas\.settingsDrawer\.close/i }),
    ).toHaveLength(1);
  });
});
