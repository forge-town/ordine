import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { newPipeline as emptyPipeline } from "../ExecutionWorkspacePage/_store/store";
import { CanvasPublishedPipeline } from "./CanvasPublishedPipeline";

const { useOne, refetch } = vi.hoisted(() => ({ useOne: vi.fn(), refetch: vi.fn() }));
const newPipeline = () => ({
  ...emptyPipeline(),
  graph: {
    ...emptyPipeline().graph,
    nodes: [{ id: "node", operation: { operationId: "identity", revision: 1 } }],
  },
});
vi.mock("@refinedev/core", () => ({ useOne }));
vi.mock("../../components/PageLoadingState", () => ({
  PageLoadingState: () => <div>正在读取定义</div>,
}));
vi.mock("./CanvasPublishedPipelineContent", () => ({
  CanvasPublishedPipelineContent: ({
    pipeline,
  }: {
    pipeline: { name: string; revision: number };
  }) => (
    <div>
      {pipeline.name} · r{pipeline.revision}
    </div>
  ),
}));

beforeEach(() => {
  useOne.mockReset();
  refetch.mockReset();
});
describe("published Canvas lookup", () => {
  it("queries the named execution provider and preserves loading", () => {
    useOne.mockReturnValue({ query: { isPending: true } });
    render(<CanvasPublishedPipeline id="canonical" />);
    expect(useOne).toHaveBeenCalledWith(
      expect.objectContaining({
        dataProviderName: "execution",
        resource: "pipelines",
        id: "canonical",
      }),
    );
    expect(screen.getByText("正在读取定义")).toBeInTheDocument();
  });
  it.each([404, 401, 500])("shows exact failure class %s and offers a read retry", (statusCode) => {
    useOne.mockReturnValue({ query: { error: { statusCode, message: "lookup failed" }, refetch } });
    render(<CanvasPublishedPipeline id="canonical" />);
    expect(
      screen.getByText(statusCode === 404 ? "已发布 Pipeline 不存在" : "无法读取已发布 Pipeline"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重试读取" }));
    expect(refetch).toHaveBeenCalledOnce();
  });
  it("rejects a mismatched canonical definition instead of running another pipeline", () => {
    useOne.mockReturnValue({
      result: { ...newPipeline(), id: "other", revision: 9 },
      query: { isSuccess: true },
    });
    render(<CanvasPublishedPipeline id="canonical" />);
    expect(screen.getByText("无法读取已发布 Pipeline")).toBeInTheDocument();
  });
  it("shows a successful null as missing", () => {
    useOne.mockReturnValue({ result: null, query: { isSuccess: true } });
    render(<CanvasPublishedPipeline id="canonical" />);
    expect(screen.getByText("已发布 Pipeline 不存在")).toBeInTheDocument();
  });
  it("passes the exact published name and revision", () => {
    useOne.mockReturnValue({
      result: { ...newPipeline(), id: "canonical", revision: 9, name: "CLI published" },
      query: { isSuccess: true },
    });
    render(<CanvasPublishedPipeline id="canonical" />);
    expect(screen.getByText("CLI published · r9")).toBeInTheDocument();
  });
});
