import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PipelineDefinitionSchema } from "@repo/schemas";
import { newPipeline } from "../ExecutionWorkspacePage/_store/store";
import { CanvasPublishedPipelineContent } from "./CanvasPublishedPipelineContent";
const { mutateAsync } = vi.hoisted(() => ({ mutateAsync: vi.fn() }));
vi.mock("@refinedev/core", () => ({
  useDataProvider: () => () => ({ getApiUrl: () => "http://canvas.test/api/v2" }),
  useCreate: () => ({ mutateAsync }),
}));
vi.mock("../../components/GlobalAgentControl", () => ({
  useOptionalAgentControlStore: () => null,
}));
vi.mock("./AgentControlBridge", () => ({ CanvasAgentControlPanel: () => <div>原 AgentBar</div> }));
vi.mock("./CanvasPublishedGraph", () => ({ CanvasPublishedGraph: () => <div>只读图</div> }));
vi.mock("../../components/ExecutionRequest/ExecutionRequestCard", () => ({
  ExecutionRequestCard: ({ requestId }: { requestId: string }) => (
    <div data-testid="request-card">{requestId}</div>
  ),
}));
const pipeline = PipelineDefinitionSchema.parse({
  ...newPipeline(),
  id: "canonical",
  name: "CLI published",
  revision: 4,
  graph: {
    schemaVersion: 2,
    inputs: [],
    nodes: [{ id: "n", operation: { operationId: "identity", revision: 1 } }],
    edges: [],
    outputs: [],
  },
});
beforeEach(() => {
  sessionStorage.clear();
  mutateAsync.mockReset();
});
describe("published Canvas run surface", () => {
  it("offers a definition reload after explicit revision conflict without querying a missing receipt", async () => {
    const onReload = vi.fn();
    mutateAsync.mockRejectedValue(
      Object.assign(new Error("revision conflict"), { statusCode: 409 }),
    );
    render(<CanvasPublishedPipelineContent pipeline={pipeline} onReload={onReload} />);
    fireEvent.click(screen.getByRole("button", { name: "运行此修订" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "重新读取已发布定义" })).toBeInTheDocument(),
    );
    expect(screen.queryByTestId("request-card")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重新读取已发布定义" }));
    expect(onReload).toHaveBeenCalledOnce();
  });
  it("preserves the AgentBar and waits for POST persistence before mounting receipt reads", async () => {
    const completion = { resolve: (_value: unknown) => {} };
    const pending = new Promise<unknown>((resolve) => {
      completion.resolve = resolve;
    });
    mutateAsync.mockReturnValue(pending);
    render(<CanvasPublishedPipelineContent pipeline={pipeline} />);
    expect(screen.getByText("原 AgentBar")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "CLI published" })).toBeInTheDocument();
    expect(screen.getByText("已发布 · 修订 4 · 只读查看")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "运行此修订" }));
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
    expect(screen.getByRole("status")).toHaveTextContent("正在提交运行请求");
    expect(screen.queryByTestId("request-card")).not.toBeInTheDocument();
    const requestId = mutateAsync.mock.calls[0]![0].values.requestId;
    await act(async () =>
      completion.resolve({
        data: {
          apiVersion: 2,
          requestId,
          state: "awaiting_approval",
          preparedRunId: "prepared",
          approvalId: "approval",
          expiresAt: "2026-10-01T00:00:00.000Z",
        },
      }),
    );
    expect(screen.getByTestId("request-card")).toHaveTextContent(requestId);
    expect(screen.getByRole("button", { name: "运行请求已提交" })).toBeDisabled();
  });
  it("mounts recovery reads on uncertain submission without resubmitting", async () => {
    mutateAsync.mockRejectedValue(new Error("lost reply"));
    const view = render(<CanvasPublishedPipelineContent pipeline={pipeline} />);
    fireEvent.click(screen.getByRole("button", { name: "运行此修订" }));
    await waitFor(() => expect(screen.getByTestId("request-card")).toBeInTheDocument());
    const requestId = screen.getByTestId("request-card").textContent;
    view.unmount();
    render(<CanvasPublishedPipelineContent pipeline={pipeline} />);
    expect(screen.getByTestId("request-card")).toHaveTextContent(requestId!);
    expect(mutateAsync).toHaveBeenCalledOnce();
  });
});
