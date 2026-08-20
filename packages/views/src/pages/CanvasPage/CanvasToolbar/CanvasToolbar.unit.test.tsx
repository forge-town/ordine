import { render } from "../../../test/test-wrapper";
import i18n from "i18next";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasPageStoreProvider } from "../_store";

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

const wrapper = ({ children }: React.PropsWithChildren) => (
  <CanvasPageStoreProvider pipeline={null}>{children}</CanvasPageStoreProvider>
);

const openCanvasActions = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByTestId("canvas-actions-menu"));
  await screen.findByRole("menu");
};

describe("CanvasToolbar - export removed", () => {
  it("does NOT render export tooltip/button in any locale", () => {
    render(<CanvasToolbar />, { wrapper });
    const exportTooltips = screen
      .queryAllByTestId("tooltip")
      .filter((el) => /导出|export/i.test(el.textContent ?? ""));

    expect(screen.queryByRole("button", { name: /导出|export/i })).not.toBeInTheDocument();
    expect(exportTooltips).toHaveLength(0);
  });
});

describe("CanvasToolbar - viewport controls", () => {
  it("uses the Alan-style pill for primary viewport controls", () => {
    render(<CanvasToolbar />, { wrapper });

    const toolbar = screen.getByTestId("canvas-v2-toolbar");
    expect(toolbar).toHaveClass(
      "absolute",
      "bottom-4",
      "right-4",
      "z-20",
      "gap-0.5",
      "rounded-full",
      "bg-surface",
      "p-1",
      "shadow-pill",
      "ring-1",
      "ring-border",
    );
    expect(toolbar.querySelector(".bg-border-strong")).toHaveClass("h-4", "w-px");
  });

  it("keeps zoom and fit view available through accessible custom controls", () => {
    render(<CanvasToolbar />, { wrapper });

    expect(screen.getByRole("button", { name: i18n.t("canvas.zoomOut") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: i18n.t("canvas.zoomIn") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: i18n.t("canvas.fitView") })).toBeInTheDocument();
    expect(screen.getByTestId("canvas-v2-zoom-reset")).toHaveTextContent("125%");
  });
});

describe("CanvasToolbar - interactive state", () => {
  it("defaults to the hand tool and switches to select", async () => {
    const user = userEvent.setup();
    render(<CanvasToolbar />, { wrapper });

    const selectTool = screen.getByRole("button", { name: i18n.t("canvas.selectTool") });
    const handTool = screen.getByRole("button", { name: i18n.t("canvas.handTool") });

    expect(handTool).toHaveAttribute("aria-pressed", "true");
    expect(selectTool).toHaveAttribute("aria-pressed", "false");

    await user.click(selectTool);

    expect(selectTool).toHaveAttribute("aria-pressed", "true");
    expect(handTool).toHaveAttribute("aria-pressed", "false");
  });

  it("toggles the custom canvas interactivity control", async () => {
    const user = userEvent.setup();
    render(<CanvasToolbar />, { wrapper });
    await openCanvasActions(user);
    await user.click(screen.getByRole("menuitem", { name: i18n.t("canvas.disableInteractivity") }));
    await openCanvasActions(user);
    expect(
      screen.getByRole("menuitem", { name: i18n.t("canvas.enableInteractivity") }),
    ).toBeInTheDocument();
  });

  it("keeps develop actions in the overflow without duplicating Run or Agent", async () => {
    const user = userEvent.setup();
    render(<CanvasToolbar />, { wrapper });
    await openCanvasActions(user);

    expect(
      screen.getByRole("menuitem", { name: i18n.t("canvas.formatLayout") }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: i18n.t("canvas.undo") })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: i18n.t("canvas.redo") })).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: i18n.t("canvas.quickAdd.open") }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: i18n.t("canvas.deleteNode") })).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: i18n.t("canvas.runTest") }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: i18n.t("canvas.agentPanel.toggle") }),
    ).not.toBeInTheDocument();
  });
});
