import { render } from "@/test/test-wrapper";
import i18n from "@/lib/i18n";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasPageStoreContext, createCanvasPageStore } from "../_store";

vi.mock("@repo/ui/button", () => ({
  Button: ({
    children,
    onClick: handleClick,
    disabled,
    title,
    className,
    ...props
  }: React.ComponentProps<"button">) => (
    <button
      {...props}
      className={className}
      disabled={disabled}
      title={title}
      onClick={handleClick}
    >
      {children}
    </button>
  ),
}));
vi.mock("@repo/ui/separator", () => ({
  Separator: ({
    orientation,
    ...props
  }: React.ComponentProps<"hr"> & { orientation?: "horizontal" | "vertical" }) => (
    <hr data-orientation={orientation} {...props} />
  ),
}));
vi.mock("@repo/ui/tooltip", () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipTrigger: ({
    children,
    render: renderProp,
  }: {
    children?: React.ReactNode;
    render?: React.ReactElement;
  }) => (
    <>
      {renderProp}
      {children}
    </>
  ),
  TooltipContent: ({ children }: React.PropsWithChildren) => (
    <span data-testid="tooltip">{children}</span>
  ),
}));

const renderToolbar = () => {
  const store = createCanvasPageStore([], [], "pipe-test", "Test Pipeline");

  render(
    <CanvasPageStoreContext.Provider value={store}>
      <CanvasToolbar />
    </CanvasPageStoreContext.Provider>,
  );

  return store;
};

describe("CanvasToolbar - viewport controls", () => {
  it("renders as a compact floating pill with one separator", () => {
    renderToolbar();

    const toolbarShell = screen.getByTestId("canvas-toolbar").firstElementChild;
    expect(toolbarShell).toHaveClass("rounded-full", "shadow-float", "backdrop-blur");
    expect(screen.getAllByRole("separator")).toHaveLength(1);
    expect(screen.getByRole("separator")).toHaveClass("h-6");
  });

  it("keeps zoom and fit view available through accessible custom controls", () => {
    renderToolbar();

    expect(screen.getByRole("button", { name: i18n.t("canvas.zoomOut") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: i18n.t("canvas.zoomIn") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: i18n.t("canvas.fitView") })).toBeInTheDocument();
  });
});

describe("CanvasToolbar - panel toggles", () => {
  it("toggles the AgentBar", async () => {
    const user = userEvent.setup();
    const store = renderToolbar();
    const toggle = screen.getByRole("button", { name: i18n.t("canvas.agentPanel.toggle") });

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(store.getState().agentPanel.isOpen).toBe(true);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
  });

  it("toggles the components panel", async () => {
    const user = userEvent.setup();
    const store = renderToolbar();
    const toggle = screen.getByRole("button", { name: i18n.t("canvas.componentPanel.collapse") });

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    await user.click(toggle);
    expect(store.getState().isSidebarOpen).toBe(false);
    expect(
      screen.getByRole("button", { name: i18n.t("canvas.componentPanel.expand") }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
