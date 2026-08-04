import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@repo/ui/sidebar";
import { createSidebarStore, SidebarStoreContext } from "../store/sidebarStore";
import { AppSidebar } from "./AppSidebar";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useRouterState: () => ({ location: { pathname: "/pipelines" } }),
}));

vi.mock("./ProjectSwitcher", () => ({
  ProjectSwitcher: () => <div>Project switcher</div>,
  DefaultUserFooter: () => <div>Desktop user</div>,
}));

describe("AppSidebar", () => {
  beforeAll(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("renders three navigation groups and valid routes", () => {
    const store = createSidebarStore();
    render(
      <SidebarStoreContext.Provider value={store}>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </SidebarStoreContext.Provider>,
    );

    expect(screen.getByText("装配")).toBeInTheDocument();
    expect(screen.getByText("监控")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "能力" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: "流水线" })).toHaveAttribute("href", "/pipelines");
    expect(screen.getByRole("link", { name: "任务" })).toHaveAttribute("href", "/pipelines/jobs");
    expect(screen.getByRole("link", { name: "设置" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("separator", { name: "Resize or toggle sidebar" })).toBeInTheDocument();
  });

  it("persists the capabilities collapsed state", () => {
    const store = createSidebarStore();
    render(
      <SidebarStoreContext.Provider value={store}>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </SidebarStoreContext.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "能力" }));

    expect(screen.queryByRole("link", { name: "设置" })).not.toBeInTheDocument();
    expect(store.getState().capabilitiesOpen).toBe(false);
    expect(localStorage.getItem("ordine.sidebar.capabilitiesOpen")).toBe("false");
  });

  it("centers the only visible header control when collapsed", () => {
    const store = createSidebarStore();
    render(
      <SidebarStoreContext.Provider value={store}>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </SidebarStoreContext.Provider>,
    );

    const brand = screen.getByText("ordine").parentElement;
    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });
    fireEvent.click(trigger);

    expect(brand).toHaveAttribute("aria-hidden", "true");
    expect(trigger).toHaveClass(
      "right-0.5",
      "top-0.5",
      "active:translate-y-0!",
      "group-data-[state=collapsed]/sidebar:right-[calc(50%_-_0.875rem)]",
    );
  });
});
