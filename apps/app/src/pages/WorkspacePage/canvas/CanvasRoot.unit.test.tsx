import { render, screen } from "@testing-library/react";
import type { PipelineData } from "@repo/schemas";
import { describe, expect, it, vi } from "vitest";
import { CanvasStoreContext, createCanvasStore } from "./_store/canvasStore";
import { fromPipelineSnapshot } from "./_store/canvasTypes";
import { CanvasRoot } from "./CanvasRoot";

vi.mock("@xyflow/react", () => ({
  BaseEdge: () => null,
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Handle: ({ type, ...props }: { type: string; [key: string]: unknown }) => (
    <div data-handle-type={type} {...props} />
  ),
  Position: { Bottom: "bottom", Left: "left", Right: "right", Top: "top" },
  ReactFlow: ({ nodes }: { nodes: { id: string }[] }) => (
    <div data-testid="mock-canvas-root-flow">{nodes.map((node) => node.id).join(",")}</div>
  ),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  getBezierPath: () => ["M0,0 C0,0 0,0 0,0", 0, 0],
  useNodeId: () => "node-a",
  useReactFlow: () => ({
    fitView: vi.fn(),
    screenToFlowPosition: ({ x, y }: { x: number; y: number }) => ({ x, y }),
    setCenter: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
  }),
  useUpdateNodeInternals: () => () => undefined,
  useViewport: () => ({ x: 0, y: 0, zoom: 0.9 }),
}));

vi.mock("@refinedev/core", () => ({
  useCustom: () => ({ result: { data: { traces: [] } } }),
  useDataProvider: () => () => ({ custom: vi.fn() }),
  useList: () => ({ result: { data: [], total: 0 } }),
  useOne: () => ({ query: { data: undefined } }),
  useUpdate: () => ({ mutate: vi.fn() }),
}));

const makePipeline = (overrides: Partial<PipelineData> = {}): PipelineData => ({
  createdAt: new Date("2026-06-11T00:00:00.000Z"),
  description: "",
  edges: [],
  id: "pipeline-test",
  name: "Pipeline",
  nodes: [],
  projectId: null,
  version: 1,
  status: "draft",
  tags: [],
  timeoutMs: null,
  updatedAt: new Date("2026-06-11T00:00:00.000Z"),
  ...overrides,
});

const renderRoot = (pipeline: PipelineData) => {
  const snapshot = fromPipelineSnapshot({ edges: pipeline.edges, nodes: pipeline.nodes });
  const store = createCanvasStore({ edges: snapshot.edges, nodes: snapshot.nodes });

  return render(
    <CanvasStoreContext.Provider value={store}>
      <CanvasRoot pipeline={pipeline} />
    </CanvasStoreContext.Provider>,
  );
};

describe("CanvasRoot", () => {
  it("renders the empty state for an empty pipeline", () => {
    renderRoot(makePipeline());

    expect(screen.getByTestId("canvas-v2-root")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-v2-empty-state")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-v2-top-pill")).toBeInTheDocument();
  });

  it("hydrates pipeline nodes into the V2 flow", () => {
    renderRoot(
      makePipeline({
        nodes: [
          {
            data: {
              label: "Prompt",
              nodeType: "prompt",
              prompt: "",
            },
            id: "node-prompt",
            position: { x: 0, y: 0 },
            type: "prompt",
          },
        ],
      }),
    );

    expect(screen.getByTestId("mock-canvas-root-flow")).toHaveTextContent("node-prompt");
    expect(screen.queryByTestId("canvas-v2-empty-state")).not.toBeInTheDocument();
  });
});
