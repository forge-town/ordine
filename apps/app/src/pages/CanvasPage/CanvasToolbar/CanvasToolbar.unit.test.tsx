import { render } from "@/test/test-wrapper";
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
  }: React.ComponentProps<"button">) => (
    <button className={className} disabled={disabled} title={title} onClick={handleClick}>
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
  it("does NOT render 导出 tooltip/button in the toolbar", () => {
    render(<CanvasToolbar />, { wrapper });
    const exportTooltips = screen
      .queryAllByTestId("tooltip")
      .filter((el) => el.textContent === "导出");
    expect(exportTooltips).toHaveLength(0);
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
    expect(screen.getByTitle("运行测试")).toBeInTheDocument();
  });

  it("Run Test button is disabled without pipelineId", () => {
    render(<CanvasToolbar />, { wrapper });
    expect(screen.getByTitle("运行测试")).toBeDisabled();
  });

  it("Run Test button is enabled when pipelineId exists", () => {
    render(<CanvasToolbar />, { wrapper: wrapperWithPipeline });
    expect(screen.getByTitle("运行测试")).not.toBeDisabled();
  });

  it("clicking Run saves pipeline then calls run API", async () => {
    const user = userEvent.setup();
    render(<CanvasToolbar />, { wrapper: wrapperWithPipeline });
    await user.click(screen.getByTitle("运行测试"));

    await waitFor(() => {
      expect(mockTrpcUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "pipe-test",
        })
      );
    });

    await waitFor(() => {
      expect(mockTrpcRun).toHaveBeenCalledWith(expect.objectContaining({ id: "pipe-test" }));
    });
  });

  it("shows success toast after successful run", async () => {
    const user = userEvent.setup();
    render(<CanvasToolbar />, { wrapper: wrapperWithPipeline });
    await user.click(screen.getByTitle("运行测试"));
    await waitFor(() => {
      expect(toastStore.getState().toasts).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "success" })])
      );
    });
  });

  it("shows error toast when save fails", async () => {
    mockTrpcUpdate.mockRejectedValue(new Error("save failed"));
    const user = userEvent.setup();
    render(<CanvasToolbar />, { wrapper: wrapperWithPipeline });
    await user.click(screen.getByTitle("运行测试"));
    await waitFor(() => {
      expect(toastStore.getState().toasts).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "error" })])
      );
    });
    expect(mockTrpcRun).not.toHaveBeenCalled();
  });

  it("shows error toast when run API fails", async () => {
    mockTrpcRun.mockRejectedValue(new Error("Internal Server Error"));
    const user = userEvent.setup();
    render(<CanvasToolbar />, { wrapper: wrapperWithPipeline });
    await user.click(screen.getByTitle("运行测试"));
    await waitFor(() => {
      expect(toastStore.getState().toasts).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "error" })])
      );
    });
  });
});
