import { fireEvent, render, screen } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@repo/ui/sidebar";
import { createNotificationStore, NotificationStoreContext } from "../store/notificationStore";
import { createSidebarStore, SidebarStoreContext } from "../store/sidebarStore";
import { AppSidebar } from "./AppSidebar";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
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

  beforeEach(() => {
    localStorage.clear();
  });

  it("renders three navigation groups and valid routes", () => {
    const store = createSidebarStore();
    const notificationStore = createNotificationStore();
    render(
      <NotificationStoreContext.Provider value={notificationStore}>
        <SidebarStoreContext.Provider value={store}>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </SidebarStoreContext.Provider>
      </NotificationStoreContext.Provider>,
    );

    expect(screen.getByText("装配")).toBeInTheDocument();
    expect(screen.getByText("监控")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "能力" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("link", { name: "流水线" })).toHaveAttribute("href", "/pipelines");
    expect(screen.getByRole("link", { name: "任务" })).toHaveAttribute("href", "/pipelines/jobs");
    expect(screen.getByRole("link", { name: "设置" })).toHaveAttribute("href", "/settings");
    expect(screen.getByRole("separator", { name: "Resize or toggle sidebar" })).toBeInTheDocument();
    for (const label of ["装配", "监控", "能力"]) {
      expect(screen.getByLabelText(label)).toHaveClass("px-2!", "py-0!");
      expect(screen.getByLabelText(label)).not.toHaveClass("p-0");
    }
  });

  it("persists the capabilities expanded state", () => {
    const store = createSidebarStore();
    const notificationStore = createNotificationStore();
    render(
      <NotificationStoreContext.Provider value={notificationStore}>
        <SidebarStoreContext.Provider value={store}>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </SidebarStoreContext.Provider>
      </NotificationStoreContext.Provider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "能力" }));

    expect(screen.getByRole("link", { name: "连接器" })).toHaveAttribute("href", "/connectors");
    expect(screen.getByRole("link", { name: "设置" })).toHaveAttribute("href", "/settings");
    expect(store.getState().capabilitiesOpen).toBe(true);
    expect(localStorage.getItem("ordine.sidebar.capabilitiesOpen")).toBe("true");
  });

  it("centers the only visible header control when collapsed", () => {
    const store = createSidebarStore();
    const notificationStore = createNotificationStore();
    render(
      <NotificationStoreContext.Provider value={notificationStore}>
        <SidebarStoreContext.Provider value={store}>
          <SidebarProvider>
            <AppSidebar />
          </SidebarProvider>
        </SidebarStoreContext.Provider>
      </NotificationStoreContext.Provider>,
    );

    const brand = screen.getByText("Ordine Studio").parentElement?.parentElement;
    const trigger = screen.getByRole("button", { name: "Toggle Sidebar" });
    fireEvent.click(trigger);

    expect(brand).toHaveAttribute("aria-hidden", "true");
    expect(trigger).toHaveClass(
      "right-0",
      "top-1.5",
      "active:translate-y-0!",
      "group-data-[state=collapsed]/sidebar:right-[calc(50%_-_0.875rem)]",
    );
  });
});
