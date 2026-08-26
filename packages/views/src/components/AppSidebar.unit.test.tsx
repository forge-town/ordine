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

  it("renders the flat main navigation and valid routes", () => {
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

    expect(screen.getByRole("link", { name: "流水线" })).toHaveAttribute("href", "/pipelines");
    expect(screen.getByRole("link", { name: "定时任务" })).toHaveAttribute("href", "/schedule");
    expect(screen.getByRole("link", { name: "插件" })).toHaveAttribute("href", "/plugins");
    expect(screen.getByRole("link", { name: "智能体" })).toHaveAttribute("href", "/agents");
    expect(screen.getByRole("link", { name: "对话" })).toHaveAttribute("href", "/assistant");
    expect(screen.getByRole("link", { name: "设置" })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("link", { name: "组件" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "连接器" })).not.toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize or toggle sidebar" })).toBeInTheDocument();
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
