import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { CanvasToolbar } from "./CanvasToolbar";
import { HarnessCanvasStoreProvider } from "../../_store";
import { useToastStore } from "@/hooks/useToastStore";

const mockCreateJob = vi.fn();
const mockUpdateJob = vi.fn();
vi.mock("@refinedev/core", () => ({
  useCreate: () => ({
    mutate: mockCreateJob,
    mutation: { isPending: false },
  }),
  useUpdate: () => ({
    mutate: mockUpdateJob,
    mutation: { isPending: false },
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

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
    mockCreateJob.mockClear();
    mockUpdateJob.mockClear();
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ text: "验证通过" }),
    });
  });

  it("renders the Run Test button", () => {
    render(<CanvasToolbar />, { wrapper });
    expect(screen.getByTitle("运行测试")).toBeInTheDocument();
  });

  it("Run Test button is enabled without pipelineId", () => {
    render(<CanvasToolbar />, { wrapper });
    expect(screen.getByTitle("运行测试")).not.toBeDisabled();
  });

  it("Run Test button is enabled when pipelineId exists", () => {
    render(<CanvasToolbar />, { wrapper: wrapperWithPipeline });
    expect(screen.getByTitle("运行测试")).not.toBeDisabled();
  });

  it("clicking Run Test calls createJob with pipeline_run type and null pipelineId when not saved", async () => {
    const user = userEvent.setup();
    render(<CanvasToolbar />, { wrapper });
    await user.click(screen.getByTitle("运行测试"));
    expect(mockCreateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "jobs",
        values: expect.objectContaining({
          type: "pipeline_run",
          pipelineId: null,
          status: "running",
        }),
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    );
  });

  it("clicking Run Test calls createJob with pipelineId when pipeline is saved", async () => {
    const user = userEvent.setup();
    render(<CanvasToolbar />, { wrapper: wrapperWithPipeline });
    await user.click(screen.getByTitle("运行测试"));
    expect(mockCreateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: "jobs",
        values: expect.objectContaining({
          type: "pipeline_run",
          pipelineId: "pipe-test",
          status: "running",
        }),
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    );
  });

  it("shows success toast after successful run", async () => {
    const user = userEvent.setup();
    mockUpdateJob.mockImplementation((_vars: unknown, callbacks: { onSuccess?: () => void }) => {
      callbacks?.onSuccess?.();
    });
    mockCreateJob.mockImplementation((_vars: unknown, callbacks: { onSuccess?: () => void }) => {
      callbacks?.onSuccess?.();
    });
    render(<CanvasToolbar />, { wrapper });
    await user.click(screen.getByTitle("运行测试"));
    await waitFor(() => {
      expect(useToastStore.getState().toasts).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "success" })])
      );
    });
    useToastStore.setState({ toasts: [] });
  });

  it("shows error toast when createJob fails", async () => {
    const user = userEvent.setup();
    mockCreateJob.mockImplementation((_vars: unknown, callbacks: { onError?: () => void }) => {
      callbacks?.onError?.();
    });
    render(<CanvasToolbar />, { wrapper });
    await user.click(screen.getByTitle("运行测试"));
    await waitFor(() => {
      expect(useToastStore.getState().toasts).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "error" })])
      );
    });
    useToastStore.setState({ toasts: [] });
  });

  it("shows error toast when Mastra validation fails", async () => {
    const user = userEvent.setup();
    mockFetch.mockRejectedValue(new Error("Mastra unavailable"));
    mockCreateJob.mockImplementation((_vars: unknown, callbacks: { onSuccess?: () => void }) => {
      callbacks?.onSuccess?.();
    });
    render(<CanvasToolbar />, { wrapper });
    await user.click(screen.getByTitle("运行测试"));
    await waitFor(() => {
      expect(useToastStore.getState().toasts).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: "error" })])
      );
    });
    useToastStore.setState({ toasts: [] });
  });
});
