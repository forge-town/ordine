import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CanvasToolbar } from "./CanvasToolbar";
import { HarnessCanvasStoreProvider } from "../_store";

vi.mock("@repo/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    title,
    className,
  }: React.ComponentProps<"button">) => (
    <button
      className={className}
      disabled={disabled}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  ),
}));
vi.mock("@repo/ui/separator", () => ({ Separator: () => <hr /> }));
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

const wrapper = ({ children }: React.PropsWithChildren) => (
  <HarnessCanvasStoreProvider pipeline={null}>
    {children}
  </HarnessCanvasStoreProvider>
);

describe("CanvasToolbar - export removed", () => {
  it("does NOT render 导出 tooltip/button in the toolbar", () => {
    render(<CanvasToolbar />, { wrapper });
    const exportTooltips = screen
      .queryAllByTestId("tooltip")
      .filter((el) => el.textContent === "导出");
    expect(exportTooltips).toHaveLength(0);
  });
});
