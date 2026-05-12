import { render } from "@/test/test-wrapper";
import i18n from "@/lib/i18n";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CanvasToolbar } from "./CanvasToolbar";
import { HarnessCanvasStoreProvider } from "../_store";
import { toastStore } from "@/store/toastStore";

const mockTrpcUpdate = vi.fn();
const mockTrpcRun = vi.fn();
vi.mock("@/integrations/trpc/client", () => ({
  trpcClient: {
    pipelines: {
      update: { mutate: (...args: unknown[]) => mockTrpcUpdate(...args) },
      run: { mutate: (...args: unknown[]) => mockTrpcRun(...args) },
    },
  },
}));

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
  <HarnessCanvasStoreProvider pipeline={null}>{children}</HarnessCanvasStoreProvider>
);

const wrapperWithPipeline = ({ children }: React.PropsWithChildren) => (
  <HarnessCanvasStoreProvider
    pipeline={{ id: "pipe-test", name: "Test Pipeline", nodes: [], edges: [] }}
  >
    {children}
  </HarnessCanvasStoreProvider>
);

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
  it("keeps zoom and fit view available through accessible custom controls", () => {
    render(<CanvasToolbar />, { wrapper });

    expect(screen.getByRole("button", { name: i18n.t("canvas.zoomOut") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: i18n.t("canvas.zoomIn") })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: i18n.t("canvas.fitView") })).toBeInTheDocument();
  });
});

describe("CanvasToolbar - Run Test button", () => {
  beforeEach(() => {
    mockTrpcUpdate.mockReset();
    mockTrpcUpdate.mockResolvedValue(undefined);
    mockTrpcRun.mockReset();
    mockTrpcRun.mockResolvedValue({ jobId: "job-123" });
    toastStore.setState({ toasts: [] });
  });

  it("renders the Run Test button", () => {
    render(<CanvasToolbar />, { wrapper });
    expect(screen.getByRole("button", { name: i18n.t("canvas.runTest") })).toBeInTheDocument();
  });

  it("Run Test button is disabled without pipelineId", () => {
    render(<CanvasToolbar />, { wrapper });
    expect(screen.getByRole("button", { name: i18n.t("canvas.runTest") })).toBeDisabled();
  });

  it("Run Test button is enabled when pipelineId exists", () => {
    render(<CanvasToolbar />, { wrapper: wrapperWithPipeline });
    expect(screen.getByRole("button", { name: i18n.t("canvas.runTest") })).not.toBeDisabled();
  });

  it("clicking Run saves pipeline then calls run API", async () => {
    const user = userEvent.setup();
    render(<CanvasToolbar />, { wrapper: wrapperWithPipeline });
    await user.click(screen.getByRole("button", { name: i18n.t("canvas.runTest") }));

    await waitFor(() => {
      expect(mockTrpcUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "pipe-test",
        }),
      );
    });

    await waitFor(() => {
      expect(mockTrpcRun).toHaveBeenCalledWith(expect.objectContaining({ id: "pipe-test" }));
    });
  });

  it("shows success toast after successful run", async () => {
    const user = userEvent.setup();
    render(<CanvasToolbar />, { wrapper: wrapperWithPipeline });
    await user.click(screen.getByRole("button", { name: i18n.t("canvas.runTest") }));
    await waitFor(() => {
      expect(toastStore.getState().toasts).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "success" })]),
      );
    });
  });

  it("shows error toast when save fails", async () => {
    mockTrpcUpdate.mockRejectedValue(new Error("save failed"));
    const user = userEvent.setup();
    render(<CanvasToolbar />, { wrapper: wrapperWithPipeline });
    await user.click(screen.getByRole("button", { name: i18n.t("canvas.runTest") }));
    await waitFor(() => {
      expect(toastStore.getState().toasts).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "error" })]),
      );
    });
    expect(mockTrpcRun).not.toHaveBeenCalled();
  });

  it("shows error toast when run API fails", async () => {
    mockTrpcRun.mockRejectedValue(new Error("Internal Server Error"));
    const user = userEvent.setup();
    render(<CanvasToolbar />, { wrapper: wrapperWithPipeline });
    await user.click(screen.getByRole("button", { name: i18n.t("canvas.runTest") }));
    await waitFor(() => {
      expect(toastStore.getState().toasts).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "error" })]),
      );
    });
  });
});

describe("CanvasToolbar - interactive state", () => {
  it("toggles the custom canvas interactivity control", async () => {
    const user = userEvent.setup();
    render(<CanvasToolbar />, { wrapper });

    const toggle = screen.getByRole("button", { name: i18n.t("canvas.disableInteractivity") });

    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await user.click(toggle);

    expect(
      screen.getByRole("button", { name: i18n.t("canvas.enableInteractivity") }),
    ).toHaveAttribute("aria-pressed", "false");
  });
});
