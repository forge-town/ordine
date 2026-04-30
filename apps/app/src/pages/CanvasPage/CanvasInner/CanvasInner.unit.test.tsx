import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ReactFlowProvider } from "@xyflow/react";
import type * as XyFlowReact from "@xyflow/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HarnessCanvasStoreProvider } from "../_store";
import type { PipelineNode } from "../_store/canvasSlice";
import { CanvasInner } from "./CanvasInner";

vi.mock("@xyflow/react", async (importOriginal) => {
  const actual = await importOriginal<typeof XyFlowReact>();

  return {
    ...actual,
    ReactFlow: ({ children }: React.PropsWithChildren) => (
      <div data-testid="react-flow">{children}</div>
    ),
  };
});

vi.mock("@/services/pipelinesService", () => ({
  updatePipeline: vi.fn(),
}));

vi.mock("@refinedev/core", () => ({
  useList: () => ({ result: { data: [] } }),
  useUpdate: () => ({ mutate: vi.fn(), mutation: { isPending: false } }),
  useCreate: () => ({ mutate: vi.fn(), mutation: { isPending: false } }),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const existingNode = {
  id: "node-1",
  type: "code-file",
  position: { x: 0, y: 0 },
  data: {
    label: "Source File",
    nodeType: "code-file",
    filePath: "src/index.ts",
    language: "typescript",
    description: "",
  },
} as PipelineNode;

const makeWrapper =
  (nodes: PipelineNode[] = []) =>
  ({ children }: React.PropsWithChildren) => (
    <QueryClientProvider client={queryClient}>
      <HarnessCanvasStoreProvider pipeline={{ id: "pipe-1", name: "Pipeline", nodes, edges: [] }}>
        <ReactFlowProvider>{children}</ReactFlowProvider>
      </HarnessCanvasStoreProvider>
    </QueryClientProvider>
  );

const wrapper = makeWrapper();

const wrapperWithNode = makeWrapper([existingNode]);

const wrapperWithoutPipeline = ({ children }: React.PropsWithChildren) => (
  <QueryClientProvider client={queryClient}>
    <HarnessCanvasStoreProvider pipeline={null}>
      <ReactFlowProvider>{children}</ReactFlowProvider>
    </HarnessCanvasStoreProvider>
  </QueryClientProvider>
);

describe("CanvasInner", () => {
  it("renders without crashing", () => {
    const { container } = render(<CanvasInner />, { wrapper: wrapperWithoutPipeline });
    expect(container.firstChild).toBeTruthy();
  });

  it("shows the canvas empty state when there are no nodes", () => {
    render(<CanvasInner />, { wrapper });

    expect(screen.getByText(/Start with a node|从一个节点开始/)).toBeInTheDocument();
  });

  it("hides the canvas empty state after nodes exist", () => {
    render(<CanvasInner />, { wrapper: wrapperWithNode });

    expect(screen.queryByText(/Start with a node|从一个节点开始/)).not.toBeInTheDocument();
  });
});
